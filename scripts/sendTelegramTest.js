const https = require('https');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envFile = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envFile)) return;
  const text = fs.readFileSync(envFile, 'utf8');
  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([^#][^=]+?)\s*=\s*(.*)$/);
    if (!match) return;
    const key = match[1].trim();
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = (process.env.TELEGRAM_CHAT_ID || '').split(',')[0].trim();
const message = `Test message from local debug at ${new Date().toISOString()}`;

const data = JSON.stringify({ chat_id: CHAT_ID, text: message });

const options = {
  hostname: 'api.telegram.org',
  path: `/bot${BOT_TOKEN}/sendMessage`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
});

req.write(data);
req.end();
