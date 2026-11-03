/** Materialize disposable, non-shipped native Loader smoke bundles. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const probe = await readFile(join(root, 'tests/p1-live-probe.js'), 'utf8');
for (const phase of ['initial', 'final']) {
  const directory = join(root, 'tests', `p1-live-${phase}`);
  const name = `@local/dsh-financial-services-p1-${phase}`;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'package.json'), JSON.stringify({
    name, version: '0.0.1', private: true, type: 'module',
    description: 'Disposable TEST_ONLY native Host acceptance fixture; not a financial product.',
    exports: { '.': './probe.js' }, files: ['probe.js', 'cordis.patch.yml'],
    engines: { dsh: '0.2.1-rc.5' }, dsh: { bundle: { patch: './cordis.patch.yml' } },
  }, null, 2) + '\n', 'utf8');
  await writeFile(join(directory, 'probe.js'), probe, 'utf8');
  await writeFile(join(directory, 'cordis.patch.yml'),
    `- insert:\n    - id: finance-p1-${phase}-probe\n      name: '${name}'\n      config:\n        phase: '${phase}'\n        bundleRoot: ${JSON.stringify(root)}\n`, 'utf8');
}
console.log('Prepared two TEST_ONLY acceptance fixtures; neither is included in the main package.');
