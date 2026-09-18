'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const appPort = process.env.APP_PORT || '8000';
const envPath = path.resolve(__dirname, '../../.env');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getTunnelUrl = async () => {
  const response = await fetch('http://127.0.0.1:4040/api/tunnels');
  const data = await response.json();
  const tunnel = data.tunnels.find(
    (candidate) =>
      candidate.proto === 'https' && candidate.config.addr.endsWith(`:${appPort}`),
  );

  return tunnel?.public_url || null;
};

const setEnvValue = ({ key, value }) => {
  const env = fs.readFileSync(envPath, 'utf8');
  const line = `${key}=${value}`;
  const nextEnv = env.match(new RegExp(`^${key}=`, 'm'))
    ? env.replace(new RegExp(`^${key}=.*$`, 'm'), line)
    : `${env.trimEnd()}\n${line}\n`;

  fs.writeFileSync(envPath, nextEnv);
};

const main = async () => {
  const ngrok = spawn('ngrok', ['http', appPort], {
    stdio: 'inherit',
  });

  ngrok.on('exit', (code) => {
    process.exitCode = code || 0;
  });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const publicUrl = await getTunnelUrl();

      if (publicUrl) {
        const webhookUrl = `${publicUrl}/api/webhook`;
        setEnvValue({
          key: 'PLAID_WEBHOOK_URL',
          value: webhookUrl,
        });
        console.log(`Updated PLAID_WEBHOOK_URL=${webhookUrl}`);
        return;
      }
    } catch (error) {
      // ngrok's local API is not ready yet.
    }

    await sleep(500);
  }

  console.warn('ngrok started, but no HTTPS tunnel URL was detected.');
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
