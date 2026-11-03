import { constants, watch } from 'node:fs'
import { access, realpath, stat } from 'node:fs/promises'
import { Service } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import { createFinanceContract } from './contract.js'
import { WorkspaceBindingOperations } from './workspace-binding.js'
import { financeReflection } from './host/reflection.js'
import { createWorkspaceTool } from './host/tool.js'

/** Native event-only directory watch. No polling, source writes or directory creation. */
function watchDirectory(directory, changed, failed) {
  const watcher = watch(directory, { persistent: false }, changed)
  watcher.on('error', failed)
  return () => watcher.close()
}

/** Financial Services P1 Host service. Default export is the Loader's sole plugin form. */
export default class FinanceOperations extends TypertRemoteService {
  static inject = ['tools', 'typert', 'workspaceRegistry', 'storageDomain']

  constructor(ctx) {
    super(ctx, 'financeOperations')
  }

  async* [Service.init]() {
    const { remote, schemas } = createFinanceContract(z)
    const domain = await this.ctx.storageDomain.open(defineDomain({
      name: 'financial_services', version: 1,
      tables: { state: domainTable(schemas.StateRoot) },
    }))
    const operations = new WorkspaceBindingOperations({
      table: domain.table('state'), registry: this.ctx.workspaceRegistry, schemas,
      filesystem: { realpath, stat, access: path => access(path, constants.R_OK | constants.X_OK) },
      watchDirectory,
      reportError: error => this.ctx.logger.warn('Financial Services directory monitoring failed: %s', String(error)),
    })
    this.operations = operations
    let registryRefresh
    // Register cleanup before asynchronous initialization; even failed activation releases the handle.
    yield async () => {
      if (registryRefresh !== undefined) clearImmediate(registryRefresh)
      await operations.dispose()
      await domain.close()
    }
    await operations.initialize()
    this.ctx.on('domain/changed', change => {
      if (change.domain !== 'workspace' || registryRefresh !== undefined) return
      // Registry publishes its entity projection after its durable domain writes settle.
      registryRefresh = setImmediate(() => {
        registryRefresh = undefined
        operations.invalidate()
      })
    })
    this.ctx.effect(() => this.ctx.typert.register({
      package: remote.package, face: 'host',
      schemas: Object.entries(schemas).map(([name, schema]) => ({ name, create: () => schema })),
      model: financeReflection(), invocations: remote.descriptors,
    }), 'finance.strictRemote')
    this.ctx.effect(() => this.ctx.tools.register(createWorkspaceTool(this, schemas, z)), 'finance.workspaceTool')
  }

  /** @param request - Exactly {}. @returns Current durable binding and observed status. */
  snapshot(request) {
    return this.requireOperations().snapshot(request)
  }

  /** @param request - Existing absolute path and current revision. @returns Bound or explicit business rejection. */
  bindWorkspace(request) {
    return this.requireOperations().bindWorkspace(request)
  }

  /** @param request - Current revision. @returns Cleared default or explicit business rejection; never deletes data. */
  unbindWorkspace(request) {
    return this.requireOperations().unbindWorkspace(request)
  }

  /** @param request - Exactly {}. @param signal - Native gateway cancellation. @returns Full initial snapshot and observed changes. */
  follow(request, signal) {
    return this.requireOperations().follow(request, signal)
  }

  requireOperations() {
    if (this.operations === undefined) throw new Error('Financial Services is not active.')
    return this.operations
  }
}
