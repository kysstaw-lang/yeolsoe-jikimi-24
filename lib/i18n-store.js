'use strict';

const { translateKo } = require('./translate');

/** Languages stored in the generic i18n_text table (English keeps its own *_en columns). */
const EXTRA_LANGS = ['zh', 'ja'];

/**
 * Chinese / Japanese versions of the Korean text the admin writes.
 * One row per (kind, ref, field, lang); `src` remembers the Korean text it was translated from,
 * so unchanged text is never translated again.
 */
function createStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS i18n_text (
      kind TEXT NOT NULL,
      ref TEXT NOT NULL,
      field TEXT NOT NULL,
      lang TEXT NOT NULL,
      src TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (kind, ref, field, lang)
    );
  `);
  const getRows = db.prepare('SELECT lang, field, src, text FROM i18n_text WHERE kind = ? AND ref = ?');
  const put = db.prepare(`INSERT INTO i18n_text (kind, ref, field, lang, src, text) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(kind, ref, field, lang) DO UPDATE SET src = excluded.src, text = excluded.text`);
  const delField = db.prepare('DELETE FROM i18n_text WHERE kind = ? AND ref = ? AND field = ?');
  const delRef = db.prepare('DELETE FROM i18n_text WHERE kind = ? AND ref = ?');

  /** { zh: { field: text }, ja: { field: text } } for one item. */
  function get(kind, ref) {
    const out = {};
    for (const l of EXTRA_LANGS) out[l] = {};
    for (const r of getRows.all(kind, String(ref))) if (out[r.lang] && r.text) out[r.lang][r.field] = r.text;
    return out;
  }

  /**
   * Make the stored translations match `fields` ({ field: koreanText }).
   * `pre(field, text, lang)` may return a ready-made translation (e.g. for plain prices).
   * Resolves true when at least one translation failed.
   */
  async function sync(kind, ref, fields, pre) {
    const rows = getRows.all(kind, String(ref));
    let failed = false;
    for (const [field, text] of Object.entries(fields)) if (!text) delField.run(kind, String(ref), field);
    await Promise.all(EXTRA_LANGS.map(async (lang) => {
      for (const [field, text] of Object.entries(fields)) {
        if (!text) continue;
        const old = rows.find((r) => r.lang === lang && r.field === field);
        if (old && old.src === text && old.text) continue;
        try {
          const ready = pre ? pre(field, text, lang) : null;
          const out = ready || (await translateKo(text, lang)).text;
          if (out) put.run(kind, String(ref), field, lang, text, out);
        } catch (err) {
          console.warn(`[translate] ${kind}.${field} -> ${lang} failed: ${err.message}`);
          failed = true;
        }
      }
    }));
    return failed;
  }

  function remove(kind, ref) {
    delRef.run(kind, String(ref));
  }

  /** Store a translation that was written by hand (used for the starter content). */
  function set(kind, ref, field, lang, src, text) {
    put.run(kind, String(ref), field, lang, src, text);
  }

  return { get, sync, remove, set };
}

module.exports = { createStore, EXTRA_LANGS };
