#!/usr/bin/env python3
"""Generate P2 assets from read-only P0 JSON evidence; stdlib only, no upstream execution.

Only assets/** and acceptance/P2-assets.json are written. No files are deleted.
An ownership/hash ledger prevents overwriting user modifications on reruns.
"""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat

ROOT = Path(__file__).resolve().parents[1]
FILE_TOOLS = {'read', 'grep', 'glob', 'write', 'edit'}
DOMAIN_ROLES = {
    'financial-analysis': ['model-builder', 'pitch-agent', 'earnings-reviewer', 'market-researcher'],
    'investment-banking': ['pitch-agent', 'meeting-prep-agent'],
    'equity-research': ['market-researcher', 'earnings-reviewer'],
    'fund-admin': ['gl-reconciler', 'kyc-screener', 'valuation-reviewer', 'month-end-closer', 'statement-auditor'],
    'wealth-management': ['meeting-prep-agent'],
    'private-equity': ['pitch-agent', 'market-researcher', 'valuation-reviewer'],
    'lseg': ['pitch-agent', 'market-researcher', 'earnings-reviewer', 'model-builder'],
    'spglobal': ['pitch-agent', 'market-researcher', 'earnings-reviewer', 'model-builder'],
}
MARKER = 'DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2'
LIMITS = """No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it."""


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def load(relative):
    return json.loads((ROOT / relative).read_text(encoding='utf-8'))


def brief(source):
    return {'path': source['path'], 'sha256': source['sha256']}


def split_frontmatter(text):
    match = re.match(r'\A---\r?\n.*?\r?\n---(?:\r?\n|$)', text, re.S)
    if not match:
        raise ValueError('Required first-line YAML frontmatter missing')
    return text[:match.end()], text[match.end():]


def mapped_text(text):
    # Keep business methods verbatim; only substitute the old platform's output path.
    return re.sub(r'\./out/?', '<runtime-assigned-artifact-directory>/', text)


def source_tree(source):
    files = {}
    for path in source.rglob('*'):
        if path.is_symlink() or path.is_junction():
            raise ValueError(f'Non-regular source entry: {path}')
        if path.is_file():
            relative = path.relative_to(source).as_posix()
            if '.git' in PurePosixPath(relative).parts:
                raise ValueError('Source archive must not include .git')
            files[relative] = path.read_bytes()
    contract = ''.join(f'{p}\0{sha(files[p])}\n' for p in sorted(files))
    return files, sha(contract.encode('utf-8'))


def source_ref_with_hash(review, source_files):
    result = copy.deepcopy(review)
    def visit(value):
        if isinstance(value, dict):
            if 'path' in value and value['path'] in source_files:
                value['sha256'] = sha(source_files[value['path']])
            for child in list(value.values()):
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
    visit(result)
    return result


def safe_destination(relative):
    p = PurePosixPath(relative)
    if p.is_absolute() or '..' in p.parts or not (relative.startswith('assets/') or relative == 'acceptance/P2-assets.json'):
        raise ValueError(f'Unauthorized generator output: {relative}')
    destination = ROOT / relative
    for component in [destination, *destination.parents]:
        if component == ROOT.parent:
            break
        if component.is_symlink() or component.is_junction():
            raise ValueError(f'Non-regular destination: {component}')
    return destination


def write_owned(outputs):
    ledger_relative = 'assets/.migration-owned.json'
    ledger_path = safe_destination(ledger_relative)
    previous = json.loads(ledger_path.read_text(encoding='utf-8'))['files'] if ledger_path.exists() else {}
    for relative, data in outputs.items():
        path = safe_destination(relative)
        if path.exists():
            actual = sha(path.read_bytes())
            if actual != sha(data) and previous.get(relative) != actual:
                raise ValueError(f'Refusing to overwrite unowned or user-modified output: {relative}')
    for relative, data in outputs.items():
        path = safe_destination(relative)
        if path.exists() and path.read_bytes() == data:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            path.chmod(stat.S_IWRITE | stat.S_IREAD)
        path.write_bytes(data)
        if relative.startswith('assets/source-archive/'):
            path.chmod(stat.S_IREAD)
    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    ledger_path.write_bytes(encode({'schemaVersion': 1, 'scope': 'Generated files only; no deletions; reject user modifications',
                                   'files': {p: sha(d) for p, d in sorted(outputs.items())}}))


def generate(source):
    inventory = load('audit/upstream/upstream-inventory.json')
    mapping = load('audit/agents/agent-mapping.json')
    groups = load('audit/upstream/skill-variants.json')['groups']
    references = load('audit/upstream/asset-references.json')['references']
    source_files, tree_hash = source_tree(source)
    assert tree_hash == inventory['summary']['sourceTreeSha256'], 'Upstream changed since P0'
    assert set(source_files) == {f['path'] for f in inventory['files']}
    for evidence in inventory['files']:
        assert sha(source_files[evidence['path']]) == evidence['sha256'], evidence['path']
    outputs = {'assets/source-archive/' + p: data for p, data in source_files.items()}
    manifest = {'schemaVersion': 1, 'sourceTreeSha256': tree_hash,
                'sourceRoot': str(source), 'roles': [], 'skills': [], 'commands': [], 'steering': [],
                'sourceArchive': {'directory': 'source-archive', 'readOnly': True, 'executionPolicy': 'PROVENANCE_ONLY_NEVER_EXECUTE_OR_INSTALL',
                                  'fileCount': len(source_files), 'files': [brief(f) for f in inventory['files']]},
                'reviewGateStatus': 'PROMPT_CHECKPOINTS_PRESERVED_P5_NOT_IMPLEMENTED',
                'commercialDataStatus': 'NOT_CONFIGURED_P3', 'officeExecutionStatus': 'EXTERNAL_RUNTIME_ADAPTATION_REQUIRED_P4',
                'treeHashContract': inventory['treeHashContract']}
    financial_groups = [g for g in groups if any(v['family'] in {'agent-plugins', 'vertical-plugins', 'partner-built'} for v in g['variants'])]
    assert len(financial_groups) == 63
    for group in financial_groups:
        assert group['fullDirectoryVariantCount'] == 1, f"Unproven same-name dedup: {group['name']}"
        v = group['variants'][0]
        name = group['name']
        originals = {f['path']: source_files[str(PurePosixPath(v['path']).parent / f['path'])] for f in v['files']}
        for variant in group['variants']:
            assert {f['path']: f['sha256'] for f in variant['files']} == {p: sha(b) for p, b in originals.items()}
        header, body = split_frontmatter(originals['SKILL.md'].decode('utf-8'))
        issues = [source_ref_with_hash(ref, source_files) for ref in references
                  if any(ref['sourcePath'].startswith(str(PurePosixPath(origin['path']).parent) + '/') for origin in group['variants'])
                  and ref['status'] not in {'RESOLVED_FILE', 'RESOLVED_DIRECTORY', 'ANCHOR_NOT_FILE', 'NON_FILE_SYNTAX_FALSE_POSITIVE'}]
        for issue in issues:
            issue['adaptationStatus'] = ('BLOCKED' if issue['status'] == 'MISSING_LOCAL_REFERENCE' else
                                         'EXTERNAL_RUNTIME_ADAPTATION_REQUIRED' if issue['status'] in {'EXTERNAL_RUNTIME_PATH_NOT_BUNDLED', 'EXTERNAL_RUNTIME_SCRIPT_NOT_BUNDLED'} else 'SOURCE_REFERENCE_RETAINED')
        # Keep precise source evidence, but distinguish missing templates from external runtime needs.
        missing = [x for x in issues if x['status'] == 'MISSING_LOCAL_REFERENCE']
        external = [x for x in issues if x['status'] in {'EXTERNAL_RUNTIME_PATH_NOT_BUNDLED', 'EXTERNAL_RUNTIME_SCRIPT_NOT_BUNDLED'}]
        status = 'BLOCKED' if missing else ('EXTERNAL_RUNTIME_ADAPTATION_REQUIRED' if external else 'PRESERVED_SOURCE_ASSETS')
        issue_notice = '\n'.join(f"> - {x['status']}: `{x['rawReference']}` ({x['sourcePath']}:{x['line']}); original SHA {x['sourceSha256']}" for x in missing + external)
        adapted = header + f'\n> **{MARKER}**\n> Original SKILL.md SHA-256: `{v["skillSha256"]}`; complete source directory archived under `source-archive/{PurePosixPath(v["path"]).parent}`.\n> Asset status: **{status}**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.\n> {LIMITS}\n' + issue_notice + '\n\n' + mapped_text(body)
        originals['SKILL.md'] = adapted.encode('utf-8')
        files = []
        for relative, data in sorted(originals.items()):
            outputs[f'assets/skills/{name}/{relative}'] = data
            original_file = next(f for f in v['files'] if f['path'] == relative)
            files.append({'path': relative, 'sha256': sha(data), 'originalSha256': original_file['sha256']})
        manifest['skills'].append({'name': name, 'description': v['description'], 'directory': f'skills/{name}',
                                   'origins': [{'path': x['path'], 'sha256': x['skillSha256'], 'treeSha256': x['treeSha256'],
                                                'files': [{'path': f['path'], 'sha256': f['sha256']} for f in x['files']]} for x in group['variants']],
                                   'files': files, 'assetStatus': status, 'issues': issues,
                                   'sourceFamilies': sorted({x['owner'] for x in group['variants'] if x['family'] in {'vertical-plugins', 'partner-built'}})})
    skills_by_name = {s['name']: s for s in manifest['skills']}
    for agent in mapping['agents']:
        main_id = 'finance-' + agent['slug']
        original_names = [x['name'] for x in agent['main_skills']]
        additions = []
        for skill in manifest['skills']:
            domains = [d for d in skill['sourceFamilies'] if agent['slug'] in DOMAIN_ROLES.get(d, [])]
            if domains and skill['name'] not in original_names:
                additions.append({'name': skill['name'], 'sourceDomains': domains,
                                  'reason': 'Explicit same-business-domain discovery extension; does not add MCP, file write, shell or delegation rights.'})
        main_skills = sorted(set(original_names + [x['name'] for x in additions]))
        worker_map = {w['name']: f"{main_id}-{w['file_slug']}" for w in agent['workers']}
        roles = [(agent, 'main', main_id, main_skills)] + [(w, 'worker', worker_map[w['name']], [s['name'] for s in w['skills']]) for w in agent['workers']]
        for obj, kind, role_id, skill_names in roles:
            is_main = kind == 'main'
            original_path = agent['plugin_prompt']['source']['path'] if is_main else obj['source']['path']
            original_sha = sha(source_files[original_path])
            source_descriptor = agent['manifest'] if is_main else obj['source']
            original_prompt = source_files[original_path] if is_main else obj['system_prompt']['text'].encode('utf-8')
            if is_main:
                _, prompt_body = split_frontmatter(original_prompt.decode('utf-8'))
            else:
                prompt_body = original_prompt.decode('utf-8')
            builtin = list(obj['tools']['builtin_allowlist'])
            allowed_mcp = list(obj['tools']['mcp_server_allowlist'])
            role = {'id': role_id, 'kind': kind, 'slug': agent['slug'] if is_main else obj['file_slug'],
                    'name': agent['plugin_prompt']['frontmatter']['name'] if is_main else obj['name'],
                    'description': agent['plugin_prompt']['frontmatter']['description'] if is_main else obj['system_prompt']['text'].strip(),
                    'parentId': None if is_main else main_id, 'builtinTools': builtin, 'allowedMcpServers': allowed_mcp,
                    'writer': 'write' in builtin, 'shellRestricted': 'bash' in builtin,
                    'exposedFileTools': [t for t in builtin if t in FILE_TOOLS],
                    'workerPresetIds': list(worker_map.values()) if is_main else [], 'skillNames': skill_names,
                    'skillRoot': f'role-skills/{role_id}', 'source': brief(source_descriptor),
                    'prompt': {'originalPath': original_path, 'originalSha256': original_sha,
                               'originalTextSha256': sha(original_prompt), 'adaptedPath': f'prompts/{role_id}.md', 'adaptedSha256': None},
                    'reviewCheckpoints': source_ref_with_hash(agent['review_checkpoints'], source_files) if is_main else [],
                    'conditionalSkillReviews': source_ref_with_hash(agent['conditional_skill_reviews'], source_files) if is_main else [],
                    'originalSkillNames': original_names if is_main else skill_names,
                    'addedSkillScope': additions if is_main else [],
                    'sourceBuiltinTools': builtin, 'upstreamWorkerName': None if is_main else obj['name']}
            if not is_main:
                role['prompt']['originalSourceRange'] = obj['system_prompt']['source']
                role['outputSchemaSource'] = obj.get('output_schema_source')
                role['outputSchemaRaw'] = obj.get('output_schema_raw')
            permissions = f"Source Managed YAML authorization baseline: {source_descriptor['path']} (SHA-256 {source_descriptor['sha256']}). Cowork Prompt frontmatter removed from main body; its broader tools are NOT authorization. Source builtin tools: {', '.join(builtin)}. Effective file interfaces keep the exact lower-case names: {', '.join(role['exposedFileTools']) or '(none)'}. Read→read; Grep→grep; Glob→glob; Write→write; Edit→edit (only when authorized). Bash/shell→UNAVAILABLE: no general-purpose shell, no temporary-script bypass; the two source Bash exceptions await bounded P4 operations."
            worker_lines = '\n'.join(f'- `{n}` → preset ID `{p}`' for n, p in worker_map.items()) if is_main else '- This Worker cannot delegate, fork, inherit a parent preset, or call a sibling.'
            data_mapping = f"Source MCP allowlist: {json.dumps(allowed_mcp)}. Original mcp__<server>__<tool>, provider-specific calls and supplier instructions map ONLY to the restricted `finance_data_query` interface, retaining this role's server allowlist and read-query semantics. P3 NOT_CONFIGURED: consult the visible runtime schema; do not invent parameters, call an arbitrary MCP tool, grant a server because a skill mentions it, or claim the provider is connected."
            adapted = f'# {MARKER}\n\n**Role `{role_id}` — source persona and business methods below; this notice overrides platform/tool assumptions only.**\n\n{permissions}\n\n{data_mapping}\n\n{LIMITS}\n\n## Worker upstreamName → DSH preset ID\n{worker_lines}\n\nMain delegation uses the runtime-exposed native subagent interface with only the listed preset IDs; no CMA API is implemented here. Workers return structured results and review requests to their owning main/Host. Only the designated source leaf writer may materialize artifacts; a read-only main/modeler returns calculations or an explicit P4 unavailable state instead of writing or running a shell.\n\n## Preserved upstream business persona and workflow\n\n{mapped_text(prompt_body)}'
            data = adapted.encode('utf-8')
            role['prompt']['adaptedSha256'] = sha(data)
            outputs['assets/' + role['prompt']['adaptedPath']] = data
            manifest['roles'].append(role)
            outputs[f'assets/{role["skillRoot"]}/.scope.json'] = encode({'schemaVersion': 1, 'roleId': role_id, 'skillNames': skill_names, 'grantsTools': False})
            for name in skill_names:
                for file in skills_by_name[name]['files']:
                    outputs[f'assets/{role["skillRoot"]}/{name}/{file["path"]}'] = outputs[f'assets/skills/{name}/{file["path"]}']
        for index, event in enumerate(agent['steering']['events'], 1):
            manifest['steering'].append({'id': f'{main_id}-steering-{index}', 'name': event['description'], 'title': event['description'], 'prompt': event['event'],
                                        'targetPresetId': main_id, 'source': {**event['source'], 'sha256': agent['steering']['source']['sha256']},
                                        'launchMode': 'draft-only', 'autoSubmit': False, 'sampleOnly': True})
    main_roles = [r for r in manifest['roles'] if r['kind'] == 'main']
    for command in [f for f in inventory['files'] if f['classification'] == 'business-command']:
        path = PurePosixPath(command['path'])
        source_group = path.parts[2]
        text = source_files[command['path']].decode('utf-8')
        # Original role/skill association is evidence; added discovery scope is not permission or routing evidence.
        group_names = {s['name'] for s in manifest['skills'] if source_group in s['sourceFamilies']}
        mentioned = sorted(n for n in group_names if re.search(r'(?<![\w-])' + re.escape(n) + r'(?![\w-])', text))
        candidates = [r['id'] for r in main_roles if any(n in r['originalSkillNames'] for n in mentioned)]
        if not candidates:
            candidates = ['finance-' + slug for slug in DOMAIN_ROLES[source_group]]
        candidates = sorted(set(candidates))
        command_id = f'finance-{source_group}-{path.stem}'
        prompt_path = f'commands/{source_group}/{path.name}'
        outputs['assets/' + prompt_path] = source_files[command['path']]
        header, _ = split_frontmatter(text)
        argument_hint = re.search(r'^argument-hint:\s*(.+)$', header, re.M)
        manifest['commands'].append({'id': command_id, 'name': path.stem, 'source': brief(command),
                                     'targetPresetId': candidates[0] if len(candidates) == 1 else None,
                                     'targetPresetIds': candidates, 'targetPresetChoices': candidates, 'selectionRequired': len(candidates) != 1,
                                     'promptPath': prompt_path, 'promptSha256': sha(source_files[command['path']]),
                                     'argumentHint': argument_hint.group(1) if argument_hint else None,
                                     'mappingEvidence': {'sourceGroup': source_group, 'mentionedSkillNames': mentioned,
                                                         'decision': 'Original Agent skill association when unique; otherwise explicit business-domain choices, never auto-run.'},
                                     'launchMode': 'draft-only', 'autoSubmit': False})
    manifest['licenses'] = [{**brief(x), 'archivePath': 'source-archive/' + x['path'], 'spdx': x['spdx']} for x in inventory['licenseFiles']]
    manifest['attribution'] = {'upstream': 'Anthropic financial-services; Apache-2.0 (see original license files)',
                               'partner': 'S&P Global skills: Copyright 2026-present Kensho Technologies, LLC.',
                               'adaptationNotice': 'Changed Prompt/SKILL.md only to add DSH platform and low-permission notices and replace ./out references; source methods and complete supporting files retained.'}
    manifest['counts'] = {'mainRoles': len(main_roles), 'workers': len(manifest['roles']) - len(main_roles),
                          'skills': len(manifest['skills']), 'commands': len(manifest['commands']), 'steering': len(manifest['steering']),
                          'writers': sum(r['writer'] for r in manifest['roles']), 'sourceShellExceptions': sum(r['shellRestricted'] for r in manifest['roles']),
                          'originalReviewCheckpoints': sum(len(r['reviewCheckpoints']) for r in main_roles),
                          'originalConditionalReviewGroups': sum(len(r['conditionalSkillReviews']) for r in main_roles),
                          'originalConditionalReviewSteps': sum(len(g['steps']) for r in main_roles for g in r['conditionalSkillReviews'])}
    assert manifest['counts'] == {'mainRoles': 10, 'workers': 30, 'skills': 63, 'commands': 41, 'steering': 29,
                                  'writers': 10, 'sourceShellExceptions': 2, 'originalReviewCheckpoints': 13,
                                  'originalConditionalReviewGroups': 20, 'originalConditionalReviewSteps': 44}, manifest['counts']
    assert set().union(*(set(r['skillNames']) for r in main_roles)) == set(skills_by_name)
    outputs['assets/agent-manifest.json'] = encode(manifest)
    outputs['assets/asset-references.json'] = encode({'schemaVersion': 1, 'sourceTreeSha256': tree_hash, 'references': references})
    outputs['assets/NOTICE.md'] = ('# Financial Services asset attribution and boundaries\n\n' + manifest['attribution']['upstream'] + '\n\n' + manifest['attribution']['partner'] + '\n\n' + manifest['attribution']['adaptationNotice'] + '\n\nAll six original license files and all 363 original files are retained byte-for-byte in source-archive as read-only provenance, not active plugins/installers. Never execute or install that archive. The archive contains the P0-audited public source only: no .git, credentials or commercial data.\n\n' + LIMITS + '\n').encode('utf-8')
    outputs['acceptance/P2-assets.json'] = encode({'schemaVersion': 1, 'phase': 'P2', 'scope': 'Asset generation and static verification only',
                                                 'status': 'GENERATED_PENDING_TEST_EXECUTION', 'sourceTreeSha256': tree_hash,
                                                 'counts': manifest['counts'], 'manifestSha256': sha(outputs['assets/agent-manifest.json']),
                                                 'validationCommand': 'node --test tests/assets.test.js',
                                                 'realLoaderVerification': 'PARENT_TASK_REQUIRED_NOT_SIMULATED',
                                                 'businessE2E': 'NOT_RUN', 'reviewGate': 'P5_NOT_IMPLEMENTED',
                                                 'dataAdapters': 'P3_NOT_CONFIGURED', 'officeExecution': 'P4_ADAPTATION_REQUIRED',
                                                 'blockedSkills': [s['name'] for s in manifest['skills'] if s['assetStatus'] == 'BLOCKED'],
                                                 'sourceScriptsExecuted': False, 'deletions': False})
    # Retain a successful actual test run only while both tested manifest and test source are unchanged.
    previous_report = ROOT / 'acceptance/P2-assets.json'
    test_path = ROOT / 'tests/assets.test.js'
    if previous_report.exists() and test_path.exists():
        previous = json.loads(previous_report.read_text(encoding='utf-8'))
        report = json.loads(outputs['acceptance/P2-assets.json'])
        evidence = previous.get('testEvidence', {})
        if previous.get('status') == 'STATIC_ASSET_TESTS_PASSED' and previous.get('manifestSha256') == report['manifestSha256'] and evidence.get('testFileSha256') == sha(test_path.read_bytes()):
            report['status'] = previous['status']
            report['testEvidence'] = evidence
            outputs['acceptance/P2-assets.json'] = encode(report)
    write_owned(outputs)
    print(json.dumps({'sourceTreeSha256': tree_hash, 'counts': manifest['counts'], 'generatedFiles': len(outputs)}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(load('audit/upstream/upstream-inventory.json')['sourceRoot']))
    args = parser.parse_args()
    generate(args.source.resolve(strict=True))
