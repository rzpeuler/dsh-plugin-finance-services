"""Read-only source/ASAR metadata and hash collection; writes only sibling JSON."""
import hashlib, json, re, struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
REF = HERE.parent / 'dsh-reference'
ASAR = Path(r'C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\app.asar')
ROOT = 'dsh/node_modules/@deepseek-ai/'
PACKAGE_DIRS = {
 'dsh-mcp-client':'mcp/mcp-client', 'dsh-mcp-resources':'mcp/mcp-resources',
 'dsh-settings':'settings/settings', 'dsh-api-settings-controller':'api/settings-controller',
 'dsh-storage-domain':'storage/storage-domain', 'dsh-storage':'storage/storage',
 'dsh-commands':'interaction/commands', 'dsh-user-questions':'interaction/user-questions',
 'dsh-user-approval':'interaction/user-approval', 'dsh-agent-preset':'preset/agent-preset',
 'dsh-agent-preset-registry':'preset/agent-preset-registry', 'dsh-skill':'skill/skill',
 'dsh-skill-filesystem':'skill/skill-filesystem', 'dsh-tool-skill':'skill/tool-skill',
 'dsh-client-resources':'client/resources', 'dsh-client-ui-slots':'client/ui-slots',
 'dsh-client-ui-plugin-manager':'client/ui-plugin-manager', 'dsh-client-ui-workspace':'client/ui-workspace',
 'dsh-client-ui-sidebar-right':'client/ui-sidebar-right', 'dsh-client-ui-deliverables':'client/ui-deliverables',
 'dsh-client-modules':'client/modules', 'dsh-api-gateway':'api/gateway',
 'dsh-api-remotes':'api/remotes', 'dsh-plugin-manager':'boot/plugin-manager',
 'dsh-typert-protocol':'typert/protocol', 'dsh-typert-registry':'typert/registry',
 'dsh-api-session-controller':'api/session-controller', 'dsh-api-workspace-controller':'api/workspace-controller',
 'dsh-tool-present':'deliverables/tool-present', 'dsh-api-workspace-files':'api/workspace-files',
}
SOURCE_FILES = [
 'AGENTS.md','packages/AGENTS.md','packages/client/AGENTS.md','packages/web/AGENTS.md',
 'docs/subsystems/client-resources.md','docs/subsystems/slots.md',
 'packages/mcp/mcp-client/src/index.ts','packages/mcp/mcp-client/src/transport.ts',
 'packages/mcp/mcp-client/README.md','packages/mcp/mcp-resources/src/index.ts',
 'packages/settings/settings/README.md','packages/api/settings-controller/src/index.ts',
 'packages/storage/storage/src/index.ts','packages/storage/storage-domain/README.md','packages/storage/storage-domain/src/domain.ts',
 'packages/interaction/commands/src/index.ts','packages/interaction/commands/README.md',
 'packages/interaction/user-questions/README.md','packages/interaction/user-approval/README.md',
 'packages/skill/skill-filesystem/src/index.ts','packages/skill/skill/src/index.ts','packages/skill/tool-skill/src/index.ts',
 'packages/preset/agent-preset/src/index.ts','packages/preset/agent-preset-registry/src/index.ts',
 'packages/preset/agent-preset-registry/src/definition.ts','packages/preset/agent-preset-registry/src/mount.ts',
 'packages/client/ui-workspace/src/client/navigation.ts',
 'packages/client/ui-plugin-manager/src/client/index.ts','packages/client/ui-plugin-manager/src/client/slot-contract.ts',
 'packages/client/ui-sidebar-right/README.md','packages/client/ui-deliverables/README.md',
 'packages/api/session-controller/src/commands.ts','packages/boot/plugin-manager/README.md',
 'packages/api/gateway/README.md','packages/api/remotes/README.md','packages/typert/generator/README.md',
 'packages/typert/registry/README.md','packages/bundle/web-app/presets/standard.patch.yml',
 'packages/client/modules/README.md','packages/client/web/src/platform.ts',
 'packages/workspace/workspace/src/index.ts',
 'packages/typert/protocol/src/index.ts','packages/typert/protocol/src/remote-info.ts',
 'packages/typert/protocol/src/types.ts','packages/typert/registry/src/types.ts',
 'packages/typert/registry/tests/typert.spec.ts','packages/api/gateway/src/index.ts',
 'packages/mcp/mcp-client/src/tools.ts','packages/mcp/mcp-client/src/connection.ts',
 'packages/api/gateway/tests/strict-source.host.spec.ts','scripts/verify-package-dependencies.spec.ts',
]
CONTRACT_SPECS = [
 ('plain-js-strict-remote','packages/api/gateway/src/index.ts',810,871,'dsh-api-gateway','Strict local descriptor plus visible binding works without SRC decorator discovery; mount same strict descriptors on Client.'),
 ('plain-js-remote-spec','packages/typert/protocol/src/types.ts',588,626,'dsh-typert-protocol','createTypertRemoteInfo accepts exact codec spec; Client may mount a direct contribution without codegen.'),
 ('plain-js-binding','packages/typert/protocol/src/index.ts',232,259,'dsh-typert-protocol','TypertRemoteService or bindTypertRemote binds Cordis service to wire namespace.'),
 ('mcp-entry','packages/mcp/mcp-client/src/index.ts',119,203,'dsh-mcp-client','No mcpManager service; one plugin instance per connection.'),
 ('mcp-transport','packages/mcp/mcp-client/src/transport.ts',31,45,'dsh-mcp-client','stdio or streamable-http; no OAuth/credential-ref config.'),
 ('mcp-resources','packages/mcp/mcp-resources/src/index.ts',74,125,'dsh-mcp-resources','Scoped list/read provider, not a connection manager.'),
 ('settings-persist','packages/api/settings-controller/src/index.ts',97,157,'dsh-api-settings-controller','describe/update/replace/mutate; expectedRevision must be supplied by finance UI.'),
 ('storage-atomic-update','packages/storage/storage-domain/src/domain.ts',82,118,'dsh-storage-domain','One record atomic update on domain chain; close owned handle; no cross-table transaction.'),
 ('human-command','packages/interaction/commands/src/index.ts',333,388,'dsh-commands','UI command path; never expose approval command as an agent tool.'),
 ('skills-isolation','packages/skill/skill/src/index.ts',345,423,'dsh-skill','Scoped provider layers do not remove inherited global providers; isolate registry when allowlist requires exclusivity.'),
 ('skills-roots','packages/skill/skill-filesystem/src/index.ts',730,755,'dsh-skill-filesystem','Scans root direct children or flat md; includeDefaultRoots false for finance-only roots.'),
 ('skill-loader','packages/skill/tool-skill/src/index.ts',128,157,'dsh-tool-skill','Tool reads same scoped registry; isolate loader together with registry.'),
 ('preset-service-leak','packages/preset/agent-preset-registry/src/mount.ts',58,82,'dsh-agent-preset-registry','Preset-owned services require an isolate realm; retained preset generations outlive declarations while used.'),
 ('session-draft','packages/client/ui-workspace/src/client/navigation.ts',73,89,'dsh-client-ui-workspace','startSession returns void, initializes draft; no promise/sessionId/execution success.'),
 ('plugin-config-slots','packages/client/ui-plugin-manager/src/client/slot-contract.ts',115,150,'dsh-client-ui-plugin-manager','Bundle keyed settings and activation slot; activation is user-enablement guidance, not durable once-only state.'),
 ('client-module-loading','packages/client/modules/README.md',32,54,'dsh-client-modules','Built ./client factory, shared module baseline and Host-driven HMR; package inject metadata is not Cordis ordering.'),
 ('remote-mount','packages/api/gateway/README.md',24,60,'dsh-api-gateway','New service needs strict generated descriptors on Host and own Client contribution mount; no discovery proxy.'),
 ('plugin-manager-lifecycle','packages/boot/plugin-manager/README.md',148,162,'dsh-plugin-manager','Removal: deselect, unload, remove package, publish resolution; failures preserve completed stages.'),
 ('deliverable-preview','packages/client/ui-deliverables/README.md',33,39,'dsh-client-ui-deliverables','Use present declarations + native file actions + sidebar resource; no component imports.'),
]

def details(data):
 return {'sha256': hashlib.sha256(data).hexdigest(), 'bytes':len(data), 'lines':len(data.splitlines())}

with ASAR.open('rb') as f:
 prefix=f.read(16)
 _,header_size,_,json_size=struct.unpack('<IIII',prefix)
 header=json.loads(f.read(json_size))
 data_offset=8+header_size
 def entry(path):
  node=header
  for part in path.split('/'):
   node=node.get('files',{}).get(part)
   if node is None: return None
  return node
 def content(path):
  node=entry(path)
  if node is None: return None
  if node.get('unpacked'):
   return Path(str(ASAR)+'.unpacked').joinpath(*path.split('/')).read_bytes()
  if 'link' in node: return content(node['link'])
  if 'offset' not in node: return None
  f.seek(data_offset+int(node['offset']))
  return f.read(node['size'])
 def leaves(value,conditions=()):
  if isinstance(value,str): yield conditions,value
  elif isinstance(value,dict):
   for key,item in value.items(): yield from leaves(item,conditions+(key,))
  elif isinstance(value,list):
   for i,item in enumerate(value): yield from leaves(item,conditions+(str(i),))
 packages=[]
 for name,directory in PACKAGE_DIRS.items():
  stem=ROOT+name+'/'
  raw=content(stem+'package.json')
  if raw is None:
   packages.append({'package':name,'installed':False}); continue
  manifest=json.loads(raw)
  reference_manifest=REF/'packages'/directory/'package.json'
  reference=json.loads(reference_manifest.read_text('utf-8'))
  targets=[]
  for conditions,target in leaves(manifest.get('exports',{})):
   if '*' in target:
    targets.append({'conditions':list(conditions),'target':target,'wildcard':True}); continue
   data=content(stem+target.removeprefix('./'))
   record={'conditions':list(conditions),'target':target,'exists':data is not None}
   if data is not None:
    record.update(details(data))
    if target.endswith('.js'):
     text=data.decode('utf-8')
     match=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',text)
     record['runtimeExportClause']=match.group(1).strip() if match else None
     needles=['async function apply(', 'function apply(', 'class extends', 'startSession(', 'registerProvider(', 'openResource(', 'defineDomain(', 'async update(', 'async mutate(', '$mount(', 'plugins.bundle.config', 'plugins.bundle.activation', 'export {']
     record['symbolLines']=[{'line':i,'marker':needle} for i,line in enumerate(text.splitlines(),1) for needle in needles if needle in line]
   targets.append(record)
  packages.append({'package':manifest['name'],'installed':True,'version':manifest['version'],
   'sourceManifest':str(reference_manifest.relative_to(REF)).replace('\\','/'),
   'sourceManifestHash':details(reference_manifest.read_bytes())['sha256'],
   'installedManifest':str(ASAR)+'/'+stem+'package.json','installedManifestMetadata':details(raw),
   'exportsEqualToReference':manifest.get('exports')==reference.get('exports'),
   'exports':manifest.get('exports'), 'dsh':manifest.get('dsh'), 'targets':targets})
 source=[]
 for rel in SOURCE_FILES:
  path=REF/rel
  source.append({'path':rel,**details(path.read_bytes())})
 scope=header['files']['dsh']['files']['node_modules']['files']['@deepseek-ai']['files']
 mcp_names=sorted(name for name in scope if 'mcp' in name)
 result={'schemaVersion':1,'auditMode':'READ_ONLY_SOURCE_AND_INSTALLED_ASAR','reference':{'root':str(REF),
  'tag':'dsh-v0.2.1-rc.5','commit':'b830ec950faba0a46dda564be3e2d854afed94f1','gitStatusShort':'',
  'verifiedBy':'git rev-parse HEAD; git status --short; git describe --tags --exact-match'},
  'runtime':{'asar':str(ASAR),'mcpPackageNames':mcp_names,'asarHeaderSize':header_size},
  'limitations':['No plugins installed or activated; no profile writes.', 'This subagent Client query timed out; parent reports earlier successful Client Service/Slots inspection, not invalidated by this timeout.',
  'Hashes are byte hashes, exports clauses are static text not module execution.', 'Wildcard exports are declarations, not a claim that every wildcard target exists.'],
  'sourceFiles':source,'packages':packages,
  'contracts':[{'id':ident,'sourcePath':path,'sourceLines':{'start':start,'end':end},
   'sourceSha256':next(item['sha256'] for item in source if item['path']==path),
   'installedPackage':'@deepseek-ai/'+package,'obligation':obligation}
   for ident,path,start,end,package,obligation in CONTRACT_SPECS],
  'observations':{'hostInspect':{'settings':'verified','storageDomain':'verified','commands':'verified','mcpManager':'no catalogued Service'},
   'clientInspect':{'Service.remote':'timed out after 10000ms'},
   'missingConcreteTargetsByExtension':{ext:sum(t.get('exists') is False and t['target'].endswith(ext) for p in packages for t in p.get('targets',[])) for ext in ['.d.ts','.js','.json']},
   'staticClientBaseline':'dsh-client-ui-slots is shell-seeded, absence as a standalone runtime package is not a missing Slot service.'}}
 (HERE/'runtime-contracts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'packages':len(packages),'sourceFiles':len(source),'mcpPackageNames':mcp_names,
  'missingConcreteTargets':sum(t.get('exists') is False for p in packages for t in p.get('targets',[])),
  'exportMismatches':[p['package'] for p in packages if p.get('exportsEqualToReference') is False]},ensure_ascii=False))
