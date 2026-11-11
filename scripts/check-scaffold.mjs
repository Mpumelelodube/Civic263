import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const json = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const appNames = ['mobile', 'web', 'ops'];
const rootPackage = await json('package.json');
assert.equal(rootPackage.private, true);
assert.deepEqual(rootPackage.workspaces, ['apps/*', 'packages/*', 'functions']);
const apps = await Promise.all(appNames.map((name) => json(`apps/${name}/package.json`)));
for (const app of apps)
  assert.equal(
    app.dependencies.react,
    '19.3.0',
    `${app.name}: keep one Expo-compatible React version`,
  );
for (const file of [
  'firebase.json',
  '.firebaserc',
  'firebase/firestore.indexes.json',
  'packages/domain/package.json',
  'packages/web-ui/package.json',
  'functions/package.json',
])
  await json(file);
for (const file of [
  'apps/mobile/src/app/index.tsx',
  'apps/mobile/src/app/report.tsx',
  'apps/mobile/src/app/my-reports.tsx',
  'apps/web/src/main.tsx',
  'apps/ops/src/main.tsx',
  'firebase/firestore.rules',
  'firebase/storage.rules',
  '.github/workflows/ci.yml',
])
  await access(new URL(file, root));
assert.equal((await json('.firebaserc')).projects.default, 'demo-civic263');
console.log(`Scaffold structure valid: ${fileURLToPath(root)}`);
