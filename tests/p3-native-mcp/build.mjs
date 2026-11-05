/** Immutable TEST_ONLY package builder. Parent alone installs; this never spawns an MCP server. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, realpath, stat } from 'node:fs/promises';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const testRoot = await realpath(dirname(fileURLToPath(import.meta.url)));
const node = await realpath(process.execPath); assert.ok(isAbsolute(node)); assert.ok((await stat(node)).isFile());
const identity = randomUUID(), short = identity.replaceAll('-', '').slice(0, 12), serverName = `finance_p3_test_${short}`;
assert.ok(serverName.length <= 32);
const packageRoot = join(testRoot, 'packages', identity), evidenceRoot = join(testRoot, 'runs', identity);
await mkdir(packageRoot, { recursive: true }); await mkdir(evidenceRoot, { recursive: true });
const nativeEntryId = `finance-p3-native-mcp-${identity}-test-only`;
const config = { identity, serverName, nativeEntryId, testRoot, evidenceRoot };
const icon = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="3" y="3" width="58" height="58" rx="12" fill="#17354d"/><path d="M26 13h12m-9 0v16L17 47a4 4 0 0 0 4 5h22a4 4 0 0 0 4-5L35 29V13" fill="none" stroke="#8ce7d1" stroke-width="3" stroke-linejoin="round"/><path d="M23 42h18" stroke="#f5cf73" stroke-width="3"/><circle cx="29" cy="35" r="2" fill="#f5cf73"/><circle cx="37" cy="47" r="2" fill="#f5cf73"/></svg>\n';
const titles = {
  native: ['TEST_ONLY Native MCP Toy Connection', '仅测试：原生 MCP 合成连接'],
  probe: ['TEST_ONLY Native MCP Host Probe', '仅测试：原生 MCP Host 验证'],
  audit: ['TEST_ONLY Native MCP Unload Audit', '仅测试：原生 MCP 卸载审计'],
};
const descriptions = {
  native: ['Connects a package-owned synthetic TOY stdio MCP server using the shipped native client; not commercial financial data.', '通过已提供的原生客户端连接包内合成 TOY stdio MCP 服务；不是真实商业金融数据。'],
  probe: ['Verifies actual native MCP calls and FinanceRole denial through public dispatch, without model turns or policy changes.', '通过公开分派验证真实原生 MCP 调用及金融角色拒绝；不运行模型或变更权限策略。'],
  audit: ['Checks native MCP tool unregistration after parent-managed removal; no manager or restart implementation.', '在父任务管理的卸载后检查原生 MCP 工具注销；不实现管理器或重启。'],
};
const targets = {};
for (const kind of ['native', 'probe', 'audit']) {
  const target = join(packageRoot, kind), name = `@local/dsh-finance-p3-native-mcp-${kind}-${identity}-test-only`;
  await mkdir(join(target, 'locale'), { recursive: true });
  const files = { 'icon.svg': icon, 'test-config.json': JSON.stringify(config, null, 2) + '\n',
    'README.md': await readFile(join(testRoot, 'README.md'), 'utf8') };
  for (const [index, locale] of ['en', 'zh'].entries()) files[`locale/${locale}.json`] = JSON.stringify({ meta: { title: titles[kind][index], description: descriptions[kind][index] } }, null, 2) + '\n';
  const sources = kind === 'native' ? ['server.js', 'protocol.js', 'toy-fixture.json'] : kind === 'probe' ? ['host-probe.js', 'protocol.js', 'connection-state.js'] : ['unload-audit.js'];
  for (const source of sources) files[source] = await readFile(join(testRoot, source), 'utf8');
  let patch;
  if (kind === 'native') patch = `- insert:\n    - id: ${nativeEntryId}\n      name: '@deepseek-ai/dsh-mcp-client'\n      config:\n        serverName: ${serverName}\n        transport: stdio\n        command: ${JSON.stringify(node)}\n        args: [${JSON.stringify(join(target, 'server.js'))}]\n        failOnStartupError: true\n        toolCallTimeoutMs: 3000\n        maxInstructionBytes: 1024\n        reconnect:\n          enabled: true\n          initialDelayMs: 250\n          maxDelayMs: 1000\n          maxAttempts: 2\n`;
  else patch = `- insert:\n    - id: finance-p3-native-mcp-${kind}-${identity}-test-only\n      name: '${name}'\n      config: {}\n`;
  files['cordis.patch.yml'] = patch;
  const exports = { './locale/*.json': './locale/*.json', './icon': './icon.svg' };
  if (kind !== 'native') exports['.'] = kind === 'probe' ? './host-probe.js' : './unload-audit.js';
  const manifest = { name, version: '0.0.1', private: true, type: 'module', description: descriptions[kind][0], license: 'UNLICENSED',
    exports, files: [...Object.keys(files), 'package.json'], engines: { dsh: '0.2.1-rc.5' }, dsh: { bundle: { patch: './cordis.patch.yml' } } };
  files['package.json'] = JSON.stringify(manifest, null, 2) + '\n';
  for (const [file, content] of Object.entries(files)) {
    await writeFile(join(target, file), content, { flag: 'wx' });
    assert.equal(await readFile(join(target, file), 'utf8'), content);
  }
  for (const file of manifest.files) assert.ok((await stat(join(target, file))).isFile());
  assert.equal(manifest.dependencies, undefined); assert.equal(manifest.scripts, undefined);
  if (kind === 'native') assert.equal(manifest.exports['.'], undefined);
  targets[`${kind}Target`] = target;
}
const result = { identity, serverName, packageRoot, ...targets, nativeEntryId, command: node,
  connectionResult: join(evidenceRoot, 'connection-result.json'), unloadResult: join(evidenceRoot, 'post-unload-result.json'),
  installed: false, serverStarted: false, manager: 'NOT_AVAILABLE', adapterBridge: 'UNSUPPORTED_PUBLIC_DELEGATION_CONTRACT',
  displayResources: 'Original SVG and English/Chinese locales included; rendered inventory not verified.' };
await writeFile(join(packageRoot, 'ready.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result, null, 2));
