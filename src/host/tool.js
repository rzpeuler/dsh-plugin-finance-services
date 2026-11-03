/** Project only supported Tool keywords; execution still validates every Zod refinement. */
function toolSchema(value) {
  const result = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'properties') {
      result.properties = Object.fromEntries(Object.entries(child).map(([name, schema]) => [name, toolSchema(schema)]))
    } else if (key === 'anyOf' || key === 'oneOf') {
      result.oneOf = child.map(toolSchema)
    } else if (key === 'items' || key === 'additionalProperties' && typeof child === 'object') {
      result[key] = toolSchema(child)
    } else if (['type', 'required', 'additionalProperties', 'enum', 'const', 'description', 'title', 'default', 'examples'].includes(key)) {
      result[key] = child
    }
  }
  return result
}

/** A narrow workspace tool; actions call exactly the same validated Host methods as Remote. */
export function createWorkspaceTool(service, schemas, z) {
  const parameters = {
    type: 'object', additionalProperties: false,
    properties: {
      action: { type: 'string', enum: ['status', 'bind', 'unbind'], description: 'Read the current binding, choose an existing directory for new tasks, or clear that default without deleting data.' },
      path: { type: 'string', description: 'For bind only: an existing fully qualified directory path; no directories are created.' },
      expectedRevision: { type: 'integer', description: 'For bind or unbind: revision returned by the latest status read; stale revisions are rejected.' },
    },
    required: ['action'],
  }
  return {
    name: 'finance_workspace',
    description: 'Read or change the default Financial Services workspace for new tasks. Existing Sessions, directories and files are retained. Returns a snapshot or a binding result with an actionable error; provides no financial execution or approval.',
    parameters,
    output: {
      schema: { oneOf: [toolSchema(z.toJSONSchema(schemas.Snapshot)), toolSchema(z.toJSONSchema(schemas.BindResult))] },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args) {
      const input = schemas.ToolRequest.parse(args)
      if (input.action === 'status') return schemas.Snapshot.parse(await service.snapshot({}))
      if (input.action === 'unbind') return schemas.BindResult.parse(await service.unbindWorkspace({ expectedRevision: input.expectedRevision }))
      return schemas.BindResult.parse(await service.bindWorkspace({ path: input.path, expectedRevision: input.expectedRevision }))
    },
    isConcurrencySafe: args => schemas.ToolRequest.safeParse(args).success && args.action === 'status',
    presentCall(args) {
      const parsed = schemas.ToolRequest.safeParse(args)
      if (!parsed.success) return undefined
      return { card: 'generic', title: 'Financial Services Workspace', kind: parsed.data.action === 'status' ? 'read' : 'other', rawInput: args }
    },
  }
}
