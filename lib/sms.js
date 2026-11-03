'use strict';

const crypto = require('crypto');
const https = require('https');
const http = require('http');

const PROD = process.env.NODE_ENV === 'production';
const API_BASE = process.env.SOLAPI_BASE || 'https://api.solapi.com';

const digits = (s) => String(s || '').replace(/\D/g, '');

function config() {
  return {
    apiKey: process.env.SOLAPI_API_KEY || '',
    apiSecret: process.env.SOLAPI_API_SECRET || '',
    sender: digits(process.env.SOLAPI_SENDER),
    // Outside production every message goes to the developer's own phone, never to the real owner.
    to: PROD ? digits(process.env.NOTIFY_PHONE) : digits(process.env.SMS_TEST_TO || '01040810406'),
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.apiKey && c.apiSecret && c.sender && c.to);
}

function authHeader(apiKey, apiSecret) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

function post(urlStr, headers, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(u, { method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) }, timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(payload);
  });
}

/** Send one SMS/LMS (Solapi picks SMS or LMS from the length). Resolves true on success. */
async function sendSms(text, subject) {
  const c = config();
  if (!isConfigured()) return false;
  const message = { to: c.to, from: c.sender, text };
  if (subject) message.subject = subject;
  const res = await post(`${API_BASE}/messages/v4/send`, {
    'Content-Type': 'application/json',
    Authorization: authHeader(c.apiKey, c.apiSecret),
  }, JSON.stringify({ message }));
  if (res.status < 200 || res.status >= 300) throw new Error(`solapi ${res.status}: ${res.body.slice(0, 200)}`);
  return true;
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Text for a new-inquiry notification. */
function inquiryText(i) {
  const lines = ['[열쇠지킴이] 새 문의'];
  if (i.region) lines.push(`지역: ${clip(i.region, 40)}`);
  lines.push(`연락처: ${i.contact}`);
  if (i.message) lines.push(`내용: ${clip(i.message.replace(/\s+/g, ' ').trim(), 300)}`);
  return lines.join('\n');
}

/** Fire-and-forget notification; failures are only logged, the inquiry is already saved. */
function notifyInquiry(inquiry) {
  if (!isConfigured()) return;
  sendSms(inquiryText(inquiry), '새 문의').catch((err) => console.warn(`[sms] notification failed: ${err.message}`));
}

module.exports = { notifyInquiry, sendSms, inquiryText, isConfigured };
