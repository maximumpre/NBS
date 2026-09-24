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

function call(method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

(async () => {
  try {
    const me = await call('getMe');
    console.log('getMe:', me);
    const updates = await call('getUpdates');
    console.log('getUpdates:', updates);
  } catch (e) {
    console.error('Error:', e);
  }
})();
