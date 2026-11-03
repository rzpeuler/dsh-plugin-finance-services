#!/usr/bin/env python3
"""Read-only, stdlib-only upstream auditor. Never imports/runs upstream code.
Only reads --source; all writes are constrained to this script's directory.
Run: python audit_upstream.py [--source C:\\Users\\Administrator\\Downloads\\financial-services-main]
Hash contract: sha256(UTF-8('relative-posix-path\\0file-sha256\\n') in ordinal path order).
Directory hashes include every regular descendant file, not only SKILL.md.
Static reference extraction is deliberately conservative; unresolved prose tokens are
candidates, not automatically defects. No external URL or runtime path is read.
"""
import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import re
from urllib.parse import unquote

OUT = Path(__file__).resolve().parent
DEFAULT_SOURCE = r'C:\Users\Administrator\Downloads\financial-services-main'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def dump(name, value):
    p = OUT / name
    assert p.parent == OUT and name in {'upstream-inventory.json', 'skill-variants.json', 'asset-references.json', 'upstream-sha256.json', 'audit-summary.json'}
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default=DEFAULT_SOURCE)
    args = parser.parse_args()
    root = Path(args.source).resolve(strict=True)
    if root == OUT or root in OUT.parents or OUT in root.parents:
        raise SystemExit('Source/output overlap rejected')
    records = []
    texts = {}
    dirs = set()
    skipped = []
    # Do not traverse junctions/symlinks or git objects; never follow paths outside source.
    for current, children, names in os.walk(root, followlinks=False):
        base = Path(current)
        accepted = []
        for n in sorted(children):
            p = base / n
            if p.is_symlink() or (hasattr(p, 'is_junction') and p.is_junction()):
                skipped.append({'path': p.relative_to(root).as_posix(), 'reason': 'SYMLINK_OR_JUNCTION_NOT_FOLLOWED'})
            elif n == '.git':
                skipped.append({'path': p.relative_to(root).as_posix(), 'reason': 'GIT_METADATA_NOT_HASHED'})
            else:
                accepted.append(n)
                dirs.add(p.relative_to(root).as_posix())
        children[:] = accepted
        for n in sorted(names):
            p = base / n
            rp = p.relative_to(root).as_posix()
            if p.is_symlink():
                skipped.append({'path': rp, 'reason': 'SYMLINK_NOT_READ'})
                continue
            data = p.read_bytes()
            try:
                text = data.decode('utf-8-sig')
                if '\x00' not in text:
                    texts[rp] = text
            except UnicodeDecodeError:
                pass
            cat, target, status = classify(rp)
            records.append({'path': rp, 'absolutePath': str(p), 'sha256': sha(data), 'bytes': len(data),
                            'classification': cat, 'migrationTarget': target, 'status': status,
                            'licenseEvidence': license_for(rp)})
    records.sort(key=lambda x: x['path'])
    bypath = {r['path']: r for r in records}
    def tree(prefix=''):
        entries = [{'path': r['path'][len(prefix):], 'sha256': r['sha256'], 'bytes': r['bytes']}
                   for r in records if r['path'].startswith(prefix)]
        h = sha(''.join(f"{r['path']}\0{r['sha256']}\n" for r in entries).encode('utf-8'))
        return h, entries
    root_hash, _ = tree()
    skills = []
    for r in records:
        if not r['path'].endswith('/SKILL.md'):
            continue
        path = r['path']
        text = texts.get(path, '')
        fm = text.split('---', 2)[1] if text.startswith('---') and len(text.split('---', 2)) > 2 else ''
        name_match = re.search(r'^name:\s*([^\n]+)', fm, re.M)
        name = name_match.group(1).strip().strip('\"\'') if name_match else None
        desc_match = re.search(r'^description:\s*(.*)', fm, re.M)
        prefix = path[:-len('SKILL.md')]
        h, entries = tree(prefix)
        family = 'office-admin' if not path.startswith('plugins/') else path.split('/')[1]
        skills.append({'name': name, 'directoryName': prefix.rstrip('/').split('/')[-1], 'path': path,
                       'family': family, 'owner': path.split('/')[2] if path.startswith('plugins/') else 'claude-for-msft-365-install',
                       'skillSha256': r['sha256'], 'treeSha256': h, 'files': entries,
                       'description': desc_match.group(1) if desc_match else None,
                       'frontmatterStatus': 'NAME_AND_DESCRIPTION_PRESENT' if name and desc_match else 'INVALID_OR_MISSING',
                       'migrationTarget': r['migrationTarget'], 'status': r['status']})
    groups = []
    for name in sorted({s['name'] for s in skills if s['name']}):
        variants = [s for s in skills if s['name'] == name]
        tree_hashes = sorted({s['treeSha256'] for s in variants})
        doc_hashes = sorted({s['skillSha256'] for s in variants})
        # Include pairwise full file diffs, including paths absent on either side.
        comparisons = []
        for i, a in enumerate(variants):
            for b in variants[i + 1:]:
                af = {f['path']: f['sha256'] for f in a['files']}
                bf = {f['path']: f['sha256'] for f in b['files']}
                comparisons.append({'left': a['path'], 'right': b['path'],
                                    'sameSkillMd': a['skillSha256'] == b['skillSha256'],
                                    'sameFullDirectory': a['treeSha256'] == b['treeSha256'],
                                    'changedFiles': sorted(p for p in af.keys() & bf.keys() if af[p] != bf[p]),
                                    'leftOnly': sorted(af.keys() - bf.keys()), 'rightOnly': sorted(bf.keys() - af.keys())})
        groups.append({'name': name, 'occurrences': len(variants), 'skillMdVariantCount': len(doc_hashes),
                       'fullDirectoryVariantCount': len(tree_hashes),
                       'decision': 'PRESERVE_ROLE_VARIANTS' if len(tree_hashes) > 1 else 'BYTE_EQUIVALENT_DIRECTORY_DEDUP_POSSIBLE_PRESERVE_ORIGINS',
                       'variants': variants, 'comparisons': comparisons})
    refs = extract_references(root, records, texts, bypath, dirs)
    for r in records:
        own_refs = [ref for ref in refs if ref['sourcePath'] == r['path']]
        r['referenceStatusCounts'] = dict(sorted(collections.Counter(ref['status'] for ref in own_refs).items()))
        r['missingReferences'] = [{'line': ref['line'], 'reference': ref['rawReference']} for ref in own_refs if ref['status'] == 'MISSING_LOCAL_REFERENCE']
        r['assetStatus'] = 'MISSING_REFERENCED_ASSET' if r['missingReferences'] else 'EXTERNAL_RUNTIME_ADAPTATION_REQUIRED' if any(ref['status'] in ('EXTERNAL_RUNTIME_PATH_NOT_BUNDLED', 'EXTERNAL_RUNTIME_SCRIPT_NOT_BUNDLED') for ref in own_refs) else 'NO_STATIC_MISSING_REFERENCE_DETECTED'
    for sk in skills:
        prefix = sk['path'][:-len('SKILL.md')]
        sk['assetIssues'] = [{'sourcePath': ref['sourcePath'], 'line': ref['line'], 'reference': ref['rawReference'], 'status': ref['status']} for ref in refs if ref['sourcePath'].startswith(prefix) and ref['status'] in ('MISSING_LOCAL_REFERENCE', 'EXTERNAL_RUNTIME_PATH_NOT_BUNDLED', 'EXTERNAL_RUNTIME_SCRIPT_NOT_BUNDLED')]
        sk['assetStatus'] = 'MISSING_REFERENCED_ASSET' if any(r['status'] == 'MISSING_LOCAL_REFERENCE' for r in sk['assetIssues']) else 'EXTERNAL_RUNTIME_ADAPTATION_REQUIRED' if sk['assetIssues'] else 'NO_STATIC_MISSING_REFERENCE_DETECTED'
    manifests = []
    integrations = []
    json_errors = []
    for path, text in sorted(texts.items()):
        if path.endswith('.json'):
            try:
                value = json.loads(text)
            except json.JSONDecodeError as e:
                json_errors.append({'path': path, 'error': str(e)})
                continue
            if path.endswith('/plugin.json') or path == '.claude-plugin/marketplace.json':
                manifests.append({'path': path, 'sha256': bypath[path]['sha256'], 'content': value})
            if path.endswith('.mcp.json'):
                for name, server in value.get('mcpServers', {}).items():
                    integrations.append({'path': path, 'sha256': bypath[path]['sha256'], 'name': name,
                                         'configuration': server, 'status': 'NOT_CONFIGURED',
                                         'installed': False, 'connected': 'NOT_TESTED', 'authorized': 'NOT_VERIFIED', 'dataQueryVerified': False})
    licenses = [{'path': r['path'], 'sha256': r['sha256'], 'spdx': 'Apache-2.0' if 'Apache License' in texts.get(r['path'], '') else 'REVIEW_REQUIRED',
                 'copyrightLines': [l.strip() for l in texts.get(r['path'], '').splitlines() if re.search('copyright', l, re.I)]}
                for r in records if Path(r['path']).name.upper().startswith(('LICENSE', 'COPYING', 'NOTICE'))]
    financial_skills = [s for s in skills if s['family'] != 'office-admin']
    vertical = {s['name'] for s in skills if s['family'] == 'vertical-plugins'}
    agents = {s['name'] for s in skills if s['family'] == 'agent-plugins'}
    partner = {s['name'] for s in skills if s['family'] == 'partner-built'}
    summary = {'fileCount': len(records), 'totalBytes': sum(r['bytes'] for r in records), 'sourceTreeSha256': root_hash,
               'classificationCounts': dict(sorted(collections.Counter(r['classification'] for r in records).items())),
               'mainAgentCount': sum(r['path'].startswith('managed-agent-cookbooks/') and r['path'].endswith('/agent.yaml') for r in records),
               'workerCount': sum('/subagents/' in r['path'] and r['path'].endswith('.yaml') for r in records),
               'skillInstanceCountAll': len(skills), 'skillInstanceCountFinancial': len(financial_skills),
               'distinctSkillNamesAll': len(groups), 'distinctSkillNamesFinancial': len({s['name'] for s in financial_skills}),
               'verticalDistinctNames': len(vertical), 'agentOnlyNames': sorted(agents - vertical - partner),
               'partnerDistinctNames': len(partner), 'multiTreeVariantNames': [g['name'] for g in groups if g['fullDirectoryVariantCount'] > 1],
               'commandCountAll': sum('/commands/' in r['path'] and r['path'].endswith('.md') for r in records),
               'commandCountFinancial': sum(r['path'].startswith('plugins/') and '/commands/' in r['path'] and r['path'].endswith('.md') for r in records),
               'mcpConfigurations': len(integrations), 'mcpDistinctUrls': len({m['configuration'].get('url') for m in integrations}),
               'referenceCounts': dict(sorted(collections.Counter(r['status'] for r in refs).items())),
               'licenseFileCount': len(licenses), 'jsonParseErrors': json_errors, 'skipped': skipped}
    payload = {'schemaVersion': 1, 'sourceRoot': str(root), 'scope': 'Only sourceRoot read; no source code executed, changed, installed or network called.',
               'git': {'dotGitPresent': (root / '.git').exists(), 'commit': None,
                       'status': 'NOT_DETERMINED_GIT_METADATA_PRESENT' if (root / '.git').exists() else 'ZIP_STYLE_SOURCE_NO_DOT_GIT_COMMIT_UNKNOWN'},
               'hashAlgorithm': 'SHA256', 'treeHashContract': 'sha256(UTF8(concat(relative-posix-path + NUL + lowercase-file-sha256 + LF))), ordinal path order; all regular descendant files',
               'summary': summary, 'files': records, 'skills': skills, 'skillGroups': groups, 'manifests': manifests,
               'mcpIntegrations': integrations, 'licenseFiles': licenses, 'assetReferences': refs,
               'limitations': ['Static extraction covers all UTF-8 source files; dynamic construction and bare natural-language filenames may need manual review.',
                               'No remote availability, entitlement, OAuth or data query was tested.',
                               'Migration targets are audit recommendations, not evidence of implementation.']}
    dump('upstream-inventory.json', payload)
    dump('skill-variants.json', {'schemaVersion': 1, 'groups': groups})
    dump('asset-references.json', {'schemaVersion': 1, 'references': refs})
    dump('upstream-sha256.json', {'schemaVersion': 1, 'sourceTreeSha256': root_hash, 'files': [{'path': r['path'], 'sha256': r['sha256'], 'bytes': r['bytes']} for r in records]})
    dump('audit-summary.json', summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


def license_for(path):
    candidates = ['LICENSE']
    if path.startswith('plugins/partner-built/spglobal/'):
        candidates.append('plugins/partner-built/spglobal/LICENSE')
        m = re.match(r'(plugins/partner-built/spglobal/skills/[^/]+)/', path)
        if m:
            candidates.append(m.group(1) + '/LICENSE')
    if path.startswith('plugins/vertical-plugins/financial-analysis/skills/skill-creator/'):
        candidates.append('plugins/vertical-plugins/financial-analysis/skills/skill-creator/LICENSE.txt')
    return candidates


def classify(p):
    if Path(p).name.upper().startswith(('LICENSE', 'NOTICE', 'COPYING')):
        return 'license', 'licenses/upstream/' + p, 'RETAIN_ATTRIBUTION_AND_LICENSE'
    if p.startswith('claude-for-msft-365-install/'):
        return 'office-platform-integration', 'compatibility/office-admin/' + p.split('/', 1)[1], 'UNAVAILABLE_EXTERNAL_PLATFORM_NOT_EQUIVALENT'
    if p.startswith('managed-agent-cookbooks/'):
        if '/subagents/' in p and p.endswith('.yaml'):
            return 'worker-config', 'presets/workers/' + p.split('/', 1)[1], 'ADAPT_PERMISSION_CONSTRAINED_WORKER'
        if p.endswith('/agent.yaml'):
            return 'managed-agent-config', 'presets/agents/' + p.split('/', 1)[1], 'ADAPT_MANAGED_AGENTS_API_TO_DSH_PRESET'
        if p.endswith('/steering-examples.json'):
            return 'task-steering-examples', 'task-templates/' + p.split('/', 1)[1], 'ADAPT_TO_DRAFT_NOT_AUTOSUBMIT'
        return 'managed-agent-documentation', 'docs/upstream/' + p, 'PRESERVE_SECURITY_AND_HANDOFF_NOTES'
    if '/agents/' in p and p.endswith('.md'):
        return 'main-agent-prompt', 'agents/' + p.split('/agents/', 1)[1], 'ADAPT_PLATFORM_CALLS_PRESERVE_BUSINESS_RULES'
    if '/skills/' in p:
        rel = p.split('/skills/', 1)[1]
        owner = p.split('/')[2]
        fam = p.split('/')[1]
        cat = 'skill-prompt' if p.endswith('/SKILL.md') else 'skill-script' if '/scripts/' in p else 'skill-reference' if '/references/' in p or '/reference/' in p else 'skill-asset' if '/assets/' in p else 'skill-support'
        return cat, 'skills/by-origin/' + fam + '/' + owner + '/' + rel, 'PRESERVE_FULL_DIRECTORY_ROLE_VARIANT'
    if '/commands/' in p:
        return 'business-command', 'commands/' + p.split('plugins/', 1)[-1], 'ADAPT_TO_SCOPED_DSH_TASK_ENTRY'
    if p.endswith('.mcp.json'):
        return 'mcp-config', 'data-adapters/upstream/' + p, 'NOT_CONFIGURED_ENTITLEMENT_REQUIRED'
    if '/.claude-plugin/' in p or p == '.claude-plugin/marketplace.json':
        return 'plugin-manifest', 'provenance/' + p, 'REFERENCE_ONLY_NOT_DSH_INSTALLABLE'
    if '/hooks/' in p:
        return 'platform-hook', 'compatibility/hooks/' + p, 'REVIEW_PLATFORM_SPECIFIC_HOOK'
    if p.startswith('scripts/'):
        return 'upstream-tooling', 'provenance/tooling/' + p.split('/', 1)[1], 'REFERENCE_ONLY_DO_NOT_EXECUTE_UNREVIEWED'
    return 'repository-governance' if p.startswith(('.', 'CLAUDE')) else 'documentation', 'provenance/' + p, 'RETAIN_REFERENCE'


def extract_references(root, records, texts, bypath, dirs):
    result = []
    seen = set()
    # Explicit links, asset subtree references, quoted file paths and runtime absolute paths.
    asset_re = re.compile(r'(?<![\w/])(?:scripts|references|reference|assets|examples)/[A-Za-z0-9_.{}*<>/-]+')
    bare_script_re = re.compile(r'(?<![\w/])(?:recalc|render_slides|slides_test)\.py\b')
    runtime_re = re.compile(r'/(?:mnt|tmp|opt|home)/[A-Za-z0-9_./${}*<>-]+')
    link_re = re.compile(r'!?\[[^\]\n]*\]\(([^\s)]+)(?:\s+[^)]*)?\)')
    code_re = re.compile(r'`([^`\n]+)`')
    yaml_ref_re = re.compile(r'\b(?:file|path|from_plugin|manifest):\s*[\"\']?([^\s\"\',}#]+)')
    for source, text in sorted(texts.items()):
        skill_base = source.split('/skills/', 1)[0] + '/skills/' + source.split('/skills/', 1)[1].split('/')[0] if '/skills/' in source else None
        candidates = []
        if source.endswith('.md'):
            for m in link_re.finditer(text): candidates.append((m.start(), m.group(1), 'markdown-link'))
        for m in asset_re.finditer(text): candidates.append((m.start(), m.group(), 'asset-path-token'))
        for m in runtime_re.finditer(text): candidates.append((m.start(), m.group(), 'runtime-path'))
        for m in bare_script_re.finditer(text): candidates.append((m.start(), m.group(), 'bare-platform-script'))
        for m in code_re.finditer(text):
            val = m.group(1)
            if '/' in val and ' ' not in val and not val.startswith(('http', 'mcp', 'POST', 'GET')):
                candidates.append((m.start(), val, 'inline-code-path'))
        if source.endswith(('.yaml', '.yml')):
            for m in yaml_ref_re.finditer(text): candidates.append((m.start(), m.group(1), 'manifest-reference'))
        for pos, raw, kind in candidates:
            raw = raw.rstrip('.,;:')
            line = text.count('\n', 0, pos) + 1
            excerpt = text.splitlines()[line - 1].strip()
            key = (source, line, raw)
            if key in seen: continue
            seen.add(key)
            resolved = None
            targets = []
            attempted = []
            status = 'UNRESOLVED_CANDIDATE_REVIEW'
            if re.match(r'^(?:https?:|mailto:|data:)', raw) or re.match(r'^[\w.-]+\.(com|org|io)/', raw):
                status = 'EXTERNAL_URL_NOT_FETCHED'
            elif raw.startswith('#'):
                status = 'ANCHOR_NOT_FILE'
            elif raw.startswith(('/mnt/', '/tmp/', '/opt/', '/home/')):
                status = 'EXTERNAL_RUNTIME_PATH_NOT_BUNDLED'
            elif kind == 'bare-platform-script':
                status = 'EXTERNAL_RUNTIME_SCRIPT_NOT_BUNDLED'
            elif raw.startswith(('./out/', 'out/', 'task4_charts/')):
                status = 'GENERATED_TASK_OUTPUT'
            elif raw.startswith(('./templates/', 'templates/')):
                status = 'USER_SUPPLIED_OR_GENERATED_TEMPLATE'
            elif raw in ('0.00', 'examples/key') or raw.startswith(('identifier=', '=IF(')):
                status = 'NON_FILE_SYNTAX_FALSE_POSITIVE'
            elif any(c in raw for c in ('<', '>', '*', '{', '}', '|')):
                status = 'DYNAMIC_OR_TEMPLATE_PATH'
            elif raw.startswith(('/', '~', '$')) or re.match(r'^[A-Za-z]:', raw):
                status = 'EXTERNAL_ABSOLUTE_PATH_NOT_READ'
            else:
                clean = unquote(raw.split('#')[0].split('?')[0])
                # Source-relative Markdown semantics first; asset paths are skill-root relative.
                bases = [Path(source).parent]
                if skill_base and raw.startswith(('scripts/', 'references/', 'reference/', 'assets/', 'examples/')):
                    bases = [Path(skill_base)] + bases
                if source.startswith('claude-for-msft-365-install/'):
                    bases += [Path('claude-for-msft-365-install')]
                bases += [Path('.')]
                for base in bases:
                    norm = os.path.normpath(str(base / clean)).replace('\\', '/')
                    if norm == '..' or norm.startswith('../'):
                        continue
                    attempted.append(norm)
                    if norm in bypath or norm in dirs:
                        targets.append(norm)
                if targets:
                    resolved = targets[0]
                    status = 'RESOLVED_FILE' if resolved in bypath else 'RESOLVED_DIRECTORY'
                elif source.endswith('skill-creator/SKILL.md') and (line in list(range(70, 101)) + list(range(128, 196)) + list(range(230, 256)) or raw in ('scripts/', 'references/', 'assets/')):
                    status = 'EXAMPLE_NOT_REQUIRED_ASSET'
                elif '/skill-creator/scripts/init_skill.py' in source:
                    status = 'GENERATED_SKILL_OUTPUT_EXAMPLE'
                elif source.endswith('ppt-template-creator/SKILL.md') and 'template.pptx' in raw:
                    status = 'USER_SUPPLIED_OR_GENERATED_TEMPLATE'
                elif kind in ('markdown-link', 'manifest-reference') or (skill_base and raw.startswith(('references/', 'reference/', 'scripts/', 'assets/', 'examples/'))):
                    status = 'MISSING_LOCAL_REFERENCE'
            review = None
            if status == 'UNRESOLVED_CANDIDATE_REVIEW':
                if raw in ('vertical-plugins/', '.claude-plugin/plugin.json', 'skills/'):
                    review = 'REVIEWED_CONTEXTUAL_PATH_SHORTHAND_NOT_A_CONCRETE_SOURCE_RELATIVE_DEPENDENCY'
                elif raw.startswith(('Data/', 'Documents/', 'local-storage/', '\"//fileserver/')):
                    review = 'REVIEWED_EXTERNAL_BROWSER_OR_NETWORK_STORAGE_NOT_READ'
                elif raw.startswith(('brk-multihub:', 'entra_scope=', 'scheme:', 'pivot.claude.ai/', 'api:', '…/vertex_ai/', 'claude-excel/')):
                    review = 'REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET'
                elif raw == '[company].com/investors':
                    review = 'REVIEWED_DYNAMIC_ISSUER_WEBSITE_TEMPLATE'
                elif raw.startswith('ppt/slides/'):
                    review = 'REVIEWED_OFFICE_ZIP_INTERNAL_MEMBER_TEMPLATE_NOT_REPOSITORY_FILE'
                elif raw == '3/8/26':
                    review = 'REVIEWED_DATE_LITERAL_NOT_FILE'
                else:
                    review = 'UNREVIEWED'
            result.append({'sourcePath': source, 'sourceSha256': bypath[source]['sha256'], 'line': line,
                           'rawReference': raw, 'kind': kind, 'excerpt': excerpt, 'status': status, 'reviewDisposition': review,
                           'resolvedPath': resolved, 'resolvedSha256': bypath[resolved]['sha256'] if resolved in bypath else None,
                           'alternativeResolvedPaths': list(dict.fromkeys(targets)),
                           'attemptedSourceRelativePaths': list(dict.fromkeys(attempted)),
                           'classification': bypath[source]['classification'], 'migrationTarget': bypath[source]['migrationTarget']})
    return sorted(result, key=lambda r: (r['sourcePath'], r['line'], r['rawReference']))

if __name__ == '__main__':
    main()
