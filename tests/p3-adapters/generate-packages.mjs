/** One-shot source scaffolding only. Creates NEW files; refuses all overwrites. No install/network. */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const template = path.join(root, 'examples/financial-data-adapter')
async function create(dir, name, content) {
  const target = path.join(dir, name)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content, { encoding: 'utf8', flag: 'wx' })
}
const control = await readFile(path.join(here, 'mcp-style/control.js'), 'utf8')
await create(path.join(here, 'rest-file-style'), 'control.js', control)
await create(template, 'control.js', control.replace("createControl(initialState = 'READY')", "createControl(initialState = 'NOT_CONFIGURED')"))
await create(template, 'client.js', await readFile(path.join(here, 'mcp-style/client.js'), 'utf8'))
const mcpIndex = await readFile(path.join(here, 'mcp-style/index.js'), 'utf8')
await create(template, 'index.js', mcpIndex
  .replaceAll('test-only-mcp', 'test-only-template')
  .replaceAll('test-mcp-statements', 'example-financial-statements')
  .replaceAll('financeTestMcpAdapter', 'financeExampleDataAdapter')
  .replaceAll('finance-test-mcp-adapter', 'finance-example-data-adapter')
  .replaceAll('TEST_ONLY MCP-style toy observation', 'TEST_ONLY independent adapter template observation')
  .replaceAll('urn:finance:test-only:mcp:', 'urn:finance:test-only:template:')
  .replace("createControl('READY')", "createControl('NOT_CONFIGURED')"))
const packages = [
  { dir: path.join(here, 'mcp-style'), name: '@local/finance-test-mcp-adapter', id: 'finance-test-mcp-adapter', color: '#176c89', mark: 'M', title: 'TEST_ONLY MCP-style financial adapter', zh: '仅测试 MCP 风格财务适配器', detail: 'In-process fake tool-call interface with invented observations. No commercial authorization or external MCP process.', zhd: '进程内模拟工具调用与虚构观测值；不启动外部 MCP 进程、不代表商业数据授权。', runtime: ['index.js', 'control.js', 'client.js'] },
  { dir: path.join(here, 'rest-file-style'), name: '@local/finance-test-rest-adapter', id: 'finance-test-rest-adapter', color: '#7753a6', mark: 'R', title: 'TEST_ONLY REST/file financial adapter', zh: '仅测试 REST／文件财务适配器', detail: 'Reads a package-owned HTTP-shaped JSON fixture. Distinct synthetic observations, no external HTTP or commercial authorization.', zhd: '读取包内 HTTP 形状 JSON；观测值独立虚构，不访问网络、不代表商业数据授权。', runtime: ['index.js', 'control.js', 'fixture.json'] },
  { dir: template, name: '@local/finance-data-adapter-example', id: 'finance-data-adapter-example', color: '#27734d', mark: 'F', title: 'TEST_ONLY financial adapter template', zh: '仅测试财务数据适配器模板', detail: 'Independent Host plugin skeleton, NOT_CONFIGURED by default; requires explicit installation and source policy binding.', zhd: '独立 Host 插件骨架，默认未配置；需显式安装和原生 Agent 作用域来源策略绑定。', runtime: ['index.js', 'control.js', 'client.js'] },
]
for (const pkg of packages) {
  await create(pkg.dir, 'package.json', JSON.stringify({
    name: pkg.name, version: '1.0.0', private: true, type: 'module', license: 'UNLICENSED',
    description: pkg.detail,
    engines: { node: '^22.19.0 || >=24', dsh: '0.2.1-rc.5' },
    exports: { '.': './index.js', './package.json': './package.json', './locale/*.json': './locale/*.json', './icon': './icon.svg' },
    files: [...pkg.runtime, 'cordis.patch.yml', 'locale/*.json', 'icon.svg', 'README.md'],
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  }, null, 2) + '\n')
  await create(pkg.dir, 'cordis.patch.yml', `- insert:\n    - id: ${pkg.id}\n      name: '${pkg.name}'\n      config: {}\n`)
  await create(pkg.dir, 'locale/en.json', JSON.stringify({ meta: { title: pkg.title, description: pkg.detail } }, null, 2) + '\n')
  await create(pkg.dir, 'locale/zh.json', JSON.stringify({ meta: { title: pkg.zh, description: pkg.zhd } }, null, 2) + '\n')
  // Original geometric artwork. Text-free paths avoid font rendering dependencies.
  const glyph = pkg.mark === 'M' ? 'M17 42V22L25 33L33 22V42' : pkg.mark === 'R' ? 'M19 42V22H29Q38 22 34 31L28 33L36 42M19 33H28' : 'M21 42V22H36M21 32H33'
  await create(pkg.dir, 'icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="3" y="3" width="58" height="58" rx="13" fill="${pkg.color}"/><path d="${glyph}" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><circle cx="49" cy="16" r="5" fill="#f4c75e"/></svg>\n`)
}
console.log('Created three independent local bundles; existing adapter runtime files were not overwritten.')
