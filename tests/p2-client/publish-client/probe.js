// TEST_ONLY publish only the verified own Client artifact through the native completed-build hook.
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
export const name = 'finance-p2-publish-client-test-only';
export const inject = ['clientModules'];
export async function apply(ctx, config) {
  const root = await realpath(config.bundleRoot);
  const manifest = JSON.parse(await readFile(join(root, 'lib/build-manifest.json'), 'utf8'));
  const bytes = await readFile(join(root, 'lib/client.js'));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== manifest.clientSha256 || manifest.package !== '@local/dsh-financial-services') throw new Error('Own Client build hash mismatch');
  const id = manifest.package;
  if (await realpath(ctx.clientModules.clientPath(id)) !== await realpath(join(root, 'lib/client.js'))) throw new Error('Not the own Client path');
  const before = ctx.clientModules.graph().entries.find(entry => entry.id === id)?.rev;
  const rev = ctx.clientModules.rebuilt(id);
  await writeFile(join(root, 'acceptance/P2-client-publication.json'), JSON.stringify({
    operation: 'native clientModules.rebuilt completed-own-build publication', package: id, clientSha256: hash, before, after: rev,
    hostAndRoleNotRewritten: true, businessExecution: false,
  }, null, 2) + '\n');
}
