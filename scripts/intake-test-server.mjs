import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

export async function startIntakeTestServer() {
  if (existsSync('functions/.secret.local')) process.loadEnvFile('functions/.secret.local');
  // This server is always local and always uses demo emulator services.
  process.env.FUNCTIONS_EMULATOR = 'true';
  process.env.GCLOUD_PROJECT = 'demo-civic263';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
  process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'demo-civic263',
    storageBucket: 'demo-civic263.appspot.com',
  });
  const sdkRequire = createRequire(import.meta.resolve('firebase-functions/v2/https'));
  const express = sdkRequire('express');
  const { submitReport, lookupPlace, getMyReports, getMyReport, publicApi } =
    await import('../functions/lib/index.js');
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.post('/demo-civic263/europe-west1/submitReport', submitReport);
  app.post('/demo-civic263/europe-west1/lookupPlace', lookupPlace);
  app.post('/demo-civic263/europe-west1/getMyReports', getMyReports);
  app.post('/demo-civic263/europe-west1/getMyReport', getMyReport);
  app.use('/demo-civic263/europe-west1/publicApi', publicApi);
  return new Promise((resolve, reject) => {
    const server = app.listen(5001, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await startIntakeTestServer();
  console.log('Demo intake HTTP handler listening at 127.0.0.1:5001. Test reports only.');
}
