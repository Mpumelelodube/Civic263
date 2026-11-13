import { build } from 'esbuild';

// Bundle shared pure domain code into the deployable functions directory.
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  packages: 'external',
  outfile: 'lib/index.js',
  sourcemap: true,
});
