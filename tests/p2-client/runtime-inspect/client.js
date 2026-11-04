// TEST_ONLY public Inspect provider: no React, Zod, remote mount, UI or user-state writes.
window.__ModuleLoader__.load({
  id: '@local/dsh-financial-services-p2-runtime-inspect',
  factory() {
    return {
      inject: ['cordisInspect'],
      apply(ctx) {
        ctx.effect(() => ctx.cordisInspect.register({
          manifest: {
            id: 'FinanceP2ClientRuntime', description: 'TEST_ONLY read-only module activation diagnostics.',
            methods: [{ name: 'state', description: 'Read public Client module queue, failures and release gate.',
              inputSchema: { type: 'object', properties: {}, additionalProperties: false },
              outputSchema: { description: 'Public Client module system state; no drafts, credentials or Session content.' } }],
          },
          async query(method) {
            if (method !== 'state') throw new Error('Unknown diagnostic method');
            const modules = ctx.get('modules');
            return { modulesPresent: Boolean(modules),
              state: modules?.entries.state.getSnapshot() ?? null,
              releaseChange: modules?.entries.releaseChange.getSnapshot() ?? null,
              services: ['remote', 'resources', 'slots', 'sessions', 'uiWorkspace', 'layout', 'conversation']
                .map(key => ({ key, present: Boolean(ctx.get(key)) })) };
          },
        }), 'TEST_ONLY finance Client diagnostics');
      },
    };
  },
});
