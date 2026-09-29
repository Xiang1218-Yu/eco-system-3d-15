import { rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';

const rootDir = new URL('..', import.meta.url).pathname;
const outdir = new URL('../node_modules/.tmp/simulator-tests', import.meta.url).pathname;
const entryPoints = [
  new URL('../src/utils/ecosystemSimulator.test.ts', import.meta.url).pathname,
  new URL('../src/store/useEcosystemStore.test.ts', import.meta.url).pathname,
];

await build({
  entryPoints,
  outdir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  alias: {
    '@': new URL('../src', import.meta.url).pathname,
  },
  external: ['node:*'],
});

const files = entryPoints.map((entryPoint) =>
  entryPoint.replace(new URL('../src', import.meta.url).pathname, `${outdir}`).replace('.ts', '.js'),
);
const child = spawn(process.execPath, ['--test', ...files], {
  cwd: rootDir,
  stdio: 'inherit',
});

child.on('exit', async (code) => {
  await rm(outdir, { recursive: true, force: true });
  process.exit(code ?? 1);
});
