// TEST_ONLY public Host graph snapshot. No Client, navigation, model, or binding mutation.
import { writeFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
export const name = 'finance-p2-client-graph-test-only';
export const inject = ['clientModules'];
export async function apply(ctx, config) {
  const root = await realpath(config.bundleRoot);
  const graph = ctx.clientModules.graph();
  const own = graph.entries.filter(entry => entry.id.startsWith('@local/dsh-financial-services'));
  const ids = new Set(graph.entries.map(entry => entry.id));
  const report = { evidence: 'PUBLIC_NATIVE_CLIENT_MODULE_GRAPH', observedAt: new Date().toISOString(),
    release: graph.release, graphRevision: graph.rev,
    entries: own.map(entry => ({ ...entry, bundlePath: ctx.clientModules.clientPath(entry.id),
      dependencies: (entry.inject ?? []).map(id => ({ id, present: ids.has(id) })) })),
    limitation: 'Host graph presence is not Client activation, rendering, transport or composer evidence.' };
  await writeFile(join(root, 'acceptance', 'P2-client-graph.json'), JSON.stringify(report, null, 2) + '\n');
}
