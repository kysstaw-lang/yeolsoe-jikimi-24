'use strict';

/**
 * Korean -> English / Chinese / Japanese machine translation for the text the admin writes.
 * Providers are tried in this order; the first one that succeeds wins:
 *   DEEPL_API_KEY, GOOGLE_TRANSLATE_API_KEY, ANTHROPIC_API_KEY (higher quality),
 *   then MyMemory, a free keyless service with small daily limits and rougher output.
 */

const TIMEOUT_MS = 20000;

/** Target languages: DeepL / Google codes, MyMemory pair and the name used in the AI prompt. */
const TARGETS = {
  en: { deepl: 'EN-US', google: 'en', mymemory: 'en', name: 'natural English' },
  zh: { deepl: 'ZH-HANS', google: 'zh-CN', mymemory: 'zh-CN', name: 'natural Simplified Chinese' },
  ja: { deepl: 'JA', google: 'ja', mymemory: 'ja', name: 'natural Japanese' },
};

function systemPrompt(lang) {
  return (
    `You translate Korean text into ${TARGETS[lang].name} for the website of a locksmith (door lock installation, key making, ` +
    'lockout service) in Seoul. Output only the translation, no notes. Preserve paragraph breaks and line breaks. ' +
    (lang === 'en'
      ? 'Use standard romanization for Seoul districts and neighborhoods (강남구 -> Gangnam-gu, 역삼동 -> Yeoksam-dong). '
      : 'Write Seoul districts (구) in their usual Chinese-character form and neighborhoods (동) in standard romanization (역삼동 -> Yeoksam-dong). ') +
    '번호키 means keypad door lock, 도어락 means door lock, 개문 means unlocking a door.'
  );
}

async function request(url, init) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, Object.assign({ signal: ctl.signal }, init));
    if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function deepl(text, lang) {
  const key = process.env.DEEPL_API_KEY;
  const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
  const data = await request(`https://${host}/v2/translate`, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: [text], source_lang: 'KO', target_lang: TARGETS[lang].deepl, preserve_formatting: true }),
  });
  return data.translations[0].text;
}

async function google(text, lang) {
  const data = await request(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(process.env.GOOGLE_TRANSLATE_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: [text], source: 'ko', target: TARGETS[lang].google, format: 'text' }),
  });
  return data.data.translations[0].translatedText;
}

async function anthropic(text, lang) {
  const data = await request('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.TRANSLATE_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: systemPrompt(lang),
      messages: [{ role: 'user', content: text }],
    }),
  });
  return data.content.map((b) => b.text || '').join('').trim();
}

/** Split text into pieces of at most `max` characters, preferring sentence boundaries. */
function chunk(text, max) {
  const sentences = text.match(/[^.!?。…]+[.!?。…]*\s*/g) || [text];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > max && cur) { out.push(cur); cur = ''; }
    if (s.length > max) {
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
    } else {
      cur += s;
    }
  }
  if (cur) out.push(cur);
  return out;
}

async function myMemory(text, lang) {
  const parts = [];
  for (const piece of chunk(text, 140)) {
    if (!piece.trim()) { parts.push(piece); continue; }
    const url = 'https://api.mymemory.translated.net/get?langpair=ko%7C' + encodeURIComponent(TARGETS[lang].mymemory) + '&q=' + encodeURIComponent(piece.trim());
    const data = await request(url, {});
    if (Number(data.responseStatus) !== 200 || !data.responseData || !data.responseData.translatedText) {
      throw new Error('mymemory: ' + (data.responseDetails || 'no result'));
    }
    parts.push(data.responseData.translatedText);
  }
  return parts.join(' ');
}

function providerList() {
  const list = [];
  if (process.env.DEEPL_API_KEY) list.push({ name: 'deepl', run: deepl, whole: true });
  if (process.env.GOOGLE_TRANSLATE_API_KEY) list.push({ name: 'google', run: google, whole: true });
  if (process.env.ANTHROPIC_API_KEY) list.push({ name: 'anthropic', run: anthropic, whole: true });
  list.push({ name: 'mymemory', run: myMemory, whole: false });
  return list;
}

async function viaProvider(provider, text, lang) {
  if (provider.whole) return (await provider.run(text, lang)).trim();
  // keyless service: translate line by line so paragraph structure survives
  const lines = text.split('\n');
  const out = [];
  for (const line of lines) out.push(line.trim() ? await provider.run(line, lang) : '');
  const joined = out.join('\n').trim();
  return lang === 'en' ? fixTerms(joined) : joined;
}

/** The keyless service mistranslates a few locksmith terms. */
function fixTerms(text) {
  return text.replace(/\bnumber keys?\b/gi, 'keypad door lock').replace(/\bdoor lock lock\b/gi, 'door lock');
}

/** Translate Korean text into `lang` (en | zh | ja). Resolves { text, provider }; rejects when every provider fails. */
async function translateKo(text, lang) {
  if (!TARGETS[lang]) throw new Error('unsupported target language: ' + lang);
  const clean = String(text || '').trim();
  if (!clean) return { text: '', provider: null };
  let lastError = null;
  for (const provider of providerList()) {
    try {
      const out = await viaProvider(provider, clean, lang);
      if (out) return { text: out, provider: provider.name };
    } catch (err) {
      lastError = err;
      console.warn(`[translate] ${provider.name} failed: ${err.message}`);
    }
  }
  throw lastError || new Error('no translation provider available');
}

const translateKoToEn = (text) => translateKo(text, 'en');

function primaryProvider() {
  return providerList()[0].name;
}

module.exports = { translateKo, translateKoToEn, primaryProvider, TARGETS };
