import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import { createScope, scopeOf, scopeChainOf, scopeTarget, ScopedLayers, NamedEntries, AnonymousEntries } from '@deepseek-ai/dsh-scope'
import * as rolePlugin from '../src/role.js'
import * as floorPlugin from '../src/floor.js'

const manifest = JSON.parse(await readFile(new URL('../assets/agent-manifest.json', import.meta.url), 'utf8'))
const roles = manifest.roles.map(role => ({ ...role, skillRoots: [resolve('assets', role.skillRoot)] }))
const services = ['financeOperations', 'tools', 'agentPresets', 'agents', 'fs', 'workingDirectory', 'sandboxPolicy', 'systemPrompt']
const modules = {
  skill: '@deepseek-ai/dsh-tool-skill', ask_user_question: '@deepseek-ai/dsh-tool-ask-user',
  send_message: '@deepseek-ai/dsh-tool-subagent-control', interrupt_agent: '@deepseek-ai/dsh-tool-subagent-control',
  list_agents: '@deepseek-ai/dsh-tool-subagent-control/list-agents', subagent: '@deepseek-ai/dsh-tool-subagent',
}
const tool = name => ({ name, description: `TEST_ONLY ${name}`, parameters: { type: 'object' }, output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, execute: async () => `TEST_ONLY ${name}` })

/** TEST_ONLY tool dispatch stub. Cordis and dsh-scope are real; this does not replace native Loader/Host verification. */
class ToolsStub extends Service {
  layers = new ScopedLayers(() => ({ tools: new NamedEntries(name => new Error(`duplicate ${name}`)), restrictions: new AnonymousEntries(), guards: new AnonymousEntries(), isEmpty() { return this.tools.isEmpty() && this.restrictions.isEmpty() && this.guards.isEmpty() } }), () => this.ctx.emit('tools/change'))
  constructor(ctx) { super(ctx, 'tools') }
  register(definition) { return this.layers.effect(this.ctx, layer => layer.tools.insert(definition.name, definition), { label: 'TEST_ONLY register' }) }
  restrict(filter) {
    assert.ok(scopeOf(this.ctx), 'restrictions must be scoped')
    return this.layers.effect(this.ctx, layer => layer.restrictions.append(filter), { label: 'TEST_ONLY restrict' })
  }
  guard(value) { return this.layers.effect(this.ctx, layer => layer.guards.append(value), { label: 'TEST_ONLY guard', notify: false }) }
  get(name, agent) { return this.view(agent).get(name) }
  view(agent) {
    const layers = this.layers.chainLayers(agent)
    const own = this.layers.peek(agent)
    const inherited = new Map(this.layers.global.tools.entries())
    for (const layer of layers) if (layer !== own) for (const entry of layer.tools.entries()) inherited.set(...entry)
    const visible = new Map([...inherited].filter(([name]) => layers.every(layer => [...layer.restrictions.values()].every(filter => (!filter.allow || filter.allow.includes(name)) && (!filter.deny || !filter.deny.includes(name))))))
    if (own) for (const entry of own.tools.entries()) visible.set(...entry)
    return visible
  }
  schemas(agent) { return [...this.view(agent).values()].map(({ name, description, parameters }) => ({ name, description, parameters })) }
  async execute(exec) {
    try {
      const definition = this.get(exec.name, exec.agent)
      if (!definition) throw new Error('UNKNOWN_TOOL')
      const decision = await this.ctx.waterfall(scopeTarget(this, exec.agent), 'tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' }))
      if (decision.kind !== 'allow') throw new Error(decision.reason)
      for (const layer of [this.layers.global, ...this.layers.chainLayers(exec.agent)]) for (const guard of layer.guards.values()) {
        const denial = guard(exec)
        if (denial !== undefined) throw new Error(denial)
      }
      const value = await definition.execute(exec.arguments, exec)
      return { isError: false, value, content: definition.output.render(exec.arguments, value) }
    } catch (error) { return { isError: true, error: { message: error.message }, content: [{ type: 'text', text: error.message }] } }
  }
}

class PromptStub extends Service {
  layers = new ScopedLayers(() => ({ entries: new NamedEntries(name => new Error(`duplicate ${name}`)), isEmpty() { return this.entries.isEmpty() } }), () => {})
  constructor(ctx) { super(ctx, 'systemPrompt') }
  context(value) { return this.layers.effect(this.ctx, layer => layer.entries.insert(value.name, value), { label: 'TEST_ONLY prompt' }) }
}

async function fixture(t, options = {}) {
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(ToolsStub)
  await ctx.plugin(PromptStub)
  const agents = []
  const compositions = new Map()
  const byId = new Map(roles.map(role => [role.id, role]))
  const grants = new Map()
  const authority = {
    async roleDefinition(id) { return byId.get(id) },
    registerRoleRuntime(agent, roleId) {
      assert.equal(grants.has(agent), false)
      grants.set(agent, roleId)
      return () => { if (grants.get(agent) === roleId) grants.delete(agent) }
    },
    isRoleRuntimeActive(agent, roleId, expected) {
      const role = byId.get(roleId)
      return grants.get(agent) === roleId && role?.source.sha256 === expected.sourceSha256 && role?.prompt.adaptedSha256 === expected.adaptedPromptSha256
    },
  }
  const revoke = ctx.provide('financeOperations', authority)
  ctx.provide('agents', { list: () => agents })
  ctx.provide('agentPresets', {
    composedPreset(context) { return scopeChainOf(scopeOf(context)).map(key => compositions.get(key)?.role.id).find(Boolean) },
    inspectCompositions(context) {
      const item = scopeChainOf(scopeOf(context)).map(key => compositions.get(key)).find(Boolean)
      return item ? [{ id: item.role.id, modules: item.nativeNames.filter(name => !options.missingModule || name !== options.missingModule).map(name => ({ moduleName: modules[name] })) }] : []
    },
  })
  ctx.provide('workingDirectory', { get: session => session.header.cwd })
  ctx.provide('sandboxPolicy', { resolve: () => ({ mode: 'workspace-write', workspaceRoot: resolve('.') }) })
  // No file reads happen in these lifecycle tests; attempting one is explicitly unavailable, not simulated data.
  ctx.provide('fs', { async lstat() { throw new Error('TEST_ONLY no FS installed in lifecycle fixture') } })
  for (const name of ['pwsh', 'write', 'subagent', 'subagent_fork', 'workflow', 'web_fetch', 'skill', 'ask_user_question']) ctx.tools.register(tool(name))
  let minter
  await ctx.plugin(Object.assign(inner => { minter = inner }, { inject: services.filter(name => name !== 'financeOperations') }))
  async function compose(role) {
    const key = {}
    const scope = createScope(minter, key)
    const nativeNames = role.kind === 'main' ? ['skill', 'ask_user_question', 'send_message', 'list_agents', 'interrupt_agent', 'subagent'] : ['skill']
    const composition = { key, scope, role, nativeNames, native: new Map() }
    compositions.set(key, composition)
    await scope.ctx.plugin(floorPlugin, { roleId: role.id, sourceSha256: role.source.sha256, adaptedPromptSha256: role.prompt.adaptedSha256 })
    for (const name of nativeNames.filter(name => name !== 'subagent')) {
      const definition = tool(name)
      composition.native.set(name, definition)
      if (name !== options.missingDefinition) scope.ctx.tools.register(definition)
    }
    composition.fiber = scope.ctx.plugin(rolePlugin, { roleId: role.id })
    await composition.fiber
    return composition
  }
  async function create(composition, id = `session-${agents.length}`) {
    const agent = { id, session: { id, header: { cwd: resolve('.'), agentPreset: composition.role.id } }, options: {} }
    const scope = createScope(minter, agent, { parent: composition.key })
    agent.ctx = scope.ctx
    agent.dispose = async () => { agents.splice(agents.indexOf(agent), 1); await scope.dispose(); ctx.emit(scopeTarget(agent, agent), 'agent/disposed', { agent }) }
    agents.push(agent)
    try {
      await ctx.serial(scopeTarget(agent, agent), 'agent/created', { agent, source: 'startup' })
      // The real native tool-subagent uses this own-Agent registration path; its backend is substituted here.
      if (composition.role.kind === 'main') agent.ctx.tools.register(tool('subagent'))
      return agent
    } catch (error) {
      agents.splice(agents.indexOf(agent), 1)
      await scope.dispose()
      throw error
    }
  }
  const dispatch = (agent, name, args = {}) => ctx.tools.execute({ agent, name, arguments: args, callId: 'TEST_ONLY-call', signal: new AbortController().signal })
  const names = agent => ctx.tools.schemas(agent).map(tool => tool.name).sort()
  return { ctx, compose, create, dispatch, names, agents, revoke, compositions, grants, byId }
}

test('actual Cordis plus scope stubs isolate main/Worker schemas and actual dispatch from ambient tools', async t => {
  const f = await fixture(t)
  const mainRole = roles.find(role => role.kind === 'main')
  const readerRole = roles.find(role => role.kind === 'worker' && !role.allowedMcpServers.length && !role.writer)
  const writerRole = roles.find(role => role.writer)
  const mainComposition = await f.compose(mainRole)
  const readerComposition = await f.compose(readerRole)
  const writerComposition = await f.compose(writerRole)
  const main = await f.create(mainComposition)
  const reader = await f.create(readerComposition)
  const writer = await f.create(writerComposition)
  assert.deepEqual(f.names(main), ['ask_user_question', 'finance_data_query', 'glob', 'grep', 'interrupt_agent', 'list_agents', 'read', 'send_message', 'skill', 'subagent'])
  assert.deepEqual(f.names(reader), ['grep', 'read', 'skill'])
  assert.deepEqual(f.names(writer), ['edit', 'read', 'skill', 'write'])
  assert.equal(f.ctx.tools.get('skill', main), mainComposition.native.get('skill'), 'native catalog identity must survive own-layer rehang')
  for (const agent of [main, reader, writer]) for (const name of ['pwsh', 'subagent_fork', 'workflow', 'web_fetch']) assert.equal((await f.dispatch(agent, name)).isError, true)
  for (const name of ['write', 'edit']) assert.equal((await f.dispatch(main, name)).isError, true)
  assert.equal((await f.dispatch(writer, 'finance_data_query', { source: 'capiq', query: 'x' })).isError, true)
  assert.equal((await f.dispatch(reader, 'ask_user_question')).isError, true)
  assert.equal((await f.dispatch(reader, 'subagent')).isError, true)
  const ordinary = { id: 'ordinary-user' }
  assert.equal((await f.dispatch(ordinary, 'pwsh')).isError, false)
  assert.equal((await f.dispatch(ordinary, 'write')).isError, false)
})

test('dispatch guards deny a same-scope alternate tool and cannot be overwritten by a pre-policy allow', async t => {
  const f = await fixture(t)
  const mainRole = roles.find(role => role.kind === 'main')
  const composition = await f.compose(mainRole)
  const agent = await f.create(composition)
  agent.ctx.on('tools/pre-execute', (_exec, _next) => Promise.resolve({ kind: 'allow' }))
  agent.ctx.tools.register(tool('alternate_delegation'))
  assert.match((await f.dispatch(agent, 'alternate_delegation')).error.message, /ROLE_TOOL_DENIED/)
  for (const args of [{}, { agent_preset: 'finance-foreign-worker' }, { agent_preset: mainRole.workerPresetIds[0], cwd: 'C:\\outside' }, { agent_preset: mainRole.workerPresetIds[0], cwd: '.' }]) assert.equal((await f.dispatch(agent, 'subagent', args)).isError, true)
  assert.equal((await f.dispatch(agent, 'subagent', { agent_preset: mainRole.workerPresetIds[0], cwd: agent.session.header.cwd })).isError, false)
  agent.session.header.delegationDepth = 1
  assert.match((await f.dispatch(agent, 'subagent', { agent_preset: mainRole.workerPresetIds[0] })).error.message, /DEPTH_DENIED/)
  agent.session.header.delegationDepth = 0
  agent.options.subagentDepth = 2
  assert.match((await f.dispatch(agent, 'subagent', { agent_preset: mainRole.workerPresetIds[0] })).error.message, /DEPTH_DENIED/)
  assert.match((await f.dispatch(agent, 'skill', { name: 'foreign-skill' })).error.message, /SKILL_DENIED/)
})

test('missing local native definitions never borrow same-name globals; missing declared module fails creation', async t => {
  for (const options of [{ missingDefinition: 'skill' }, { missingModule: 'skill' }]) {
    const f = await fixture(t, options)
    const composition = await f.compose(roles.find(role => role.kind === 'worker'))
    await assert.rejects(f.create(composition), /NATIVE_ROLE_DEPENDENCY/)
    assert.equal(f.names({ id: 'ordinary-user' }).includes('pwsh'), true)
  }
})

test('Agent disposal removes own tools/masks/guards; another Agent and the original preset registrations remain independent', async t => {
  const f = await fixture(t)
  const composition = await f.compose(roles.find(role => role.kind === 'worker'))
  const first = await f.create(composition)
  const second = await f.create(composition)
  const held = f.ctx.tools.get('read', first)
  const firstLayer = f.ctx.tools.layers.peek(first)
  assert.equal([...firstLayer.guards.values()].length, 1)
  await first.dispose()
  assert.equal(f.ctx.tools.layers.peek(first), undefined)
  assert.equal(f.names(first).includes('pwsh'), false, 'retained preset floor must still mask ambient tools')
  assert.equal(f.names(second).includes('read'), true)
  await assert.rejects(held.execute({ file_path: 'input.txt' }, { agent: first, signal: new AbortController().signal }), /ROLE_AGENT_REQUIRED/)
  assert.ok(f.ctx.tools.get('read', composition.key))
})

test('role plugin disposal removes its Agent contributions without lifting independent retained floor or leaking ordinary tools', async t => {
  const f = await fixture(t)
  const role = roles.find(role => role.kind === 'worker')
  const composition = await f.compose(role)
  const agent = await f.create(composition)
  const held = f.ctx.tools.get('read', agent)
  await composition.fiber.dispose()
  assert.equal(f.ctx.tools.layers.peek(agent), undefined)
  assert.deepEqual(f.names(agent), [], 'only the independent inherited floor remains')
  for (const name of ['pwsh', 'write', 'read', 'subagent', 'subagent_fork']) assert.equal((await f.dispatch(agent, name)).isError, true)
  await assert.rejects(held.execute({ file_path: 'x' }, { agent, signal: new AbortController().signal }), /ROLE_AGENT_REQUIRED/)
  assert.equal((await f.dispatch({ id: 'ordinary-user' }, 'pwsh')).isError, false)
  assert.equal([...f.ctx.systemPrompt.layers.chainLayers(agent)].flatMap(layer => [...layer.entries.values()]).length, 0)
})

test('global authority removal unloads hard-dependent role effects while independent floor keeps retained Workers closed', async t => {
  const f = await fixture(t)
  const composition = await f.compose(roles.find(role => role.kind === 'worker'))
  const agent = await f.create(composition)
  const held = f.ctx.tools.get('read', agent)
  await f.revoke()
  assert.equal(f.ctx.tools.layers.peek(agent), undefined)
  assert.deepEqual(f.names(agent), [])
  for (const name of ['pwsh', 'write', 'subagent', 'subagent_fork']) assert.equal((await f.dispatch(agent, name)).isError, true)
  await assert.rejects(held.execute({ file_path: 'x' }, { agent, signal: new AbortController().signal }), /ROLE_AGENT_REQUIRED/)
  assert.equal((await f.dispatch({ id: 'ordinary-user' }, 'pwsh')).isError, false)
})

test('independent native floor denies retained main-own subagent after role unmount or global owner removal', async t => {
  for (const removeRoot of [false, true]) {
    const f = await fixture(t)
    const role = roles.find(role => role.kind === 'main')
    const composition = await f.compose(role)
    const agent = await f.create(composition)
    const args = { agent_preset: role.workerPresetIds[0] }
    assert.equal((await f.dispatch(agent, 'subagent', args)).isError, false)
    assert.equal(f.grants.has(agent), true)
    if (removeRoot) await f.revoke()
    else await composition.fiber.dispose()
    assert.equal(f.grants.has(agent), false)
    assert.equal(f.names(agent).includes('subagent'), true, 'native own registration belongs to native plugin, not role cleanup')
    assert.match((await f.dispatch(agent, 'subagent', args)).error.message, /ROLE_AUTHORITY_UNAVAILABLE/)
    for (const name of ['pwsh', 'write', 'workflow', 'subagent_fork']) assert.equal((await f.dispatch(agent, name)).isError, true)
    assert.equal((await f.dispatch({ id: 'ordinary-user' }, 'subagent', {})).isError, false)
  }
})

test('floor source/prompt revision checks refuse an active grant when trusted source identity drifts', async t => {
  const f = await fixture(t)
  const role = roles.find(role => role.kind === 'main')
  const composition = await f.compose(role)
  const agent = await f.create(composition)
  f.byId.set(role.id, { ...role, source: { ...role.source, sha256: '0'.repeat(64) } })
  assert.equal(f.grants.has(agent), true)
  assert.match((await f.dispatch(agent, 'subagent', { agent_preset: role.workerPresetIds[0] })).error.message, /ROLE_AUTHORITY_UNAVAILABLE/)
  assert.match((await f.dispatch(agent, 'finance_data_query', { source: role.allowedMcpServers[0], query: 'x' })).error.message, /ROLE_AUTHORITY_UNAVAILABLE/)
})

test('same role ID in separate retained composition scopes does not share effects or runtime grants', async t => {
  const f = await fixture(t)
  const role = roles.find(role => role.kind === 'worker')
  const firstComposition = await f.compose(role)
  const secondComposition = await f.compose(role)
  const first = await f.create(firstComposition)
  const second = await f.create(secondComposition)
  await firstComposition.fiber.dispose()
  assert.equal(f.names(first).includes('read'), false)
  assert.equal(f.names(second).includes('read'), true)
  assert.equal(f.grants.has(first), false)
  assert.equal(f.grants.has(second), true)
  assert.equal(f.names(first).includes('pwsh'), false)
})

test('entry validates Config strictly and requires a genuine composition scope', async t => {
  const f = await fixture(t)
  for (const input of [{}, { roleId: 'generic' }, { roleId: roles[0].id, root: 'C:\\outside' }, { roleId: '../finance-main' }]) await assert.rejects(rolePlugin.apply(f.ctx, input))
  await assert.rejects(rolePlugin.apply(f.ctx, { roleId: roles[0].id }), /ROLE_SCOPE_REQUIRED/)
  assert.equal('default' in rolePlugin, false)
})
