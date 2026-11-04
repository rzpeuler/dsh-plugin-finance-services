// TEST_ONLY public module/registry diagnostics; no private fields or lifecycle mutation.
window.__ModuleLoader__.load({
  id: '@local/dsh-financial-services-p2-runtime-inspect-2',
  factory(require) {
    return { inject: ['cordisInspect'], apply(ctx) {
      ctx.effect(() => ctx.cordisInspect.register({
        manifest: { id: 'FinanceP2ClientRuntime2', description: 'TEST_ONLY public startup-state diagnostics.',
          methods: [{ name: 'state', description: 'Read own module exports and public Cordis fiber startup errors.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            outputSchema: { description: 'Only finance test package lifecycle and baseline functions; no drafts or secrets.' } }] },
        async query() {
          const modules = ctx.get('modules');
          const z = require('zod').z;
          const plugins = [];
          for (const id of ['@local/dsh-financial-services', '@local/dsh-financial-services-p2-client-retry-1']) {
            const record = modules?.loadCache.get(id);
            const exported = record?.exports;
            const plugin = exported?.default ?? exported;
            const runtime = plugin && ctx.registry.get(plugin);
            const fibers = [];
            for (const fiber of runtime?.fibers ?? []) {
              let error = null;
              if (!fiber.inertia) {
                try { await fiber.await(); } catch (e) { error = { name: e.name, message: String(e.message), stack: String(e.stack).slice(0, 6000) }; }
              }
              fibers.push({ state: fiber.state, loading: Boolean(fiber.inertia), inject: Object.keys(fiber.inject), error });
            }
            plugins.push({ id, materialized: Boolean(record), exportedKeys: exported ? Object.keys(exported) : [], registered: Boolean(runtime), fibers });
          }
          return { state: modules?.entries.state.getSnapshot() ?? null, releaseChange: modules?.entries.releaseChange.getSnapshot() ?? null,
            baseline: { strictObject: typeof z.strictObject, uuid: typeof z.string().uuid, TextEncoder: typeof TextEncoder }, plugins };
        },
      }), 'TEST_ONLY startup diagnostics');
    } };
  },
});
