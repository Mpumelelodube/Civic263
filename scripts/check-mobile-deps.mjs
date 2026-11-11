import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cli = require.resolve('expo/bin/cli');
const result = spawnSync(process.execPath, [cli, 'install', '--check'], {
  cwd: fileURLToPath(new URL('../apps/mobile', import.meta.url)),
  env: { ...process.env, EXPO_OFFLINE: '1', CI: '1' },
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
