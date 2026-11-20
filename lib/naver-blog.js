'use strict';

/** Pull out a bare blog ID from whatever the admin pastes ("example123", "blog.naver.com/example123", a full URL, ...). */
function parseBlogId(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  const m = /blog\.naver\.com\/([a-zA-Z0-9_-]+)/.exec(s);
  const id = m ? m[1] : s.replace(/^@/, '');
  return /^[a-zA-Z0-9_-]{2,30}$/.test(id) ? id : '';
}

const decodeEntities = (s) => String(s || '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
  .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const MAX_ITEMS = 30;

/** First <img src="..."> inside a post's (CDATA) description snippet, or '' if none. */
function firstImage(block) {
  const desc = (/<description>([\s\S]*?)<\/description>/.exec(block) || [, ''])[1];
  const src = (/<img[^>]+src="([^"]+)"/.exec(desc) || [, ''])[1];
  return src && /^https:\/\//i.test(src) ? src : '';
}

/**
 * Latest posts from a Naver blog's public RSS feed, newest first.
 * Each item: { title, url, logNo, thumbnail } - url is the canonical https://blog.naver.com/{blogId}/{logNo} link
 * (Naver's <link> carries tracking params; <guid> is the clean one, so that's preferred).
 * thumbnail is the first image found in the post's description snippet, or '' if the snippet has none.
 */
async function fetchNaverBlogPosts(blogId) {
  const id = parseBlogId(blogId);
  if (!id) throw new Error('블로그 아이디를 확인할 수 없어요.');
  const res = await fetch(`https://rss.blog.naver.com/${encodeURIComponent(id)}.xml`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`네이버에서 블로그를 찾을 수 없어요. (${res.status})`);
  const xml = await res.text();
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) && items.length < MAX_ITEMS) {
    const block = m[1];
    const title = decodeEntities((/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block) || [, ''])[1]);
    const guid = ((/<guid>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/.exec(block) || [, ''])[1] || '').trim();
    const link = ((/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/.exec(block) || [, ''])[1] || '').trim();
    const url = (guid || link).split('?')[0];
    const logM = /\/(\d+)\/?$/.exec(url);
    if (title && url && logM) items.push({ title: title.slice(0, 200), url, logNo: logM[1], thumbnail: firstImage(block) });
  }
  return items;
}

module.exports = { parseBlogId, fetchNaverBlogPosts };
