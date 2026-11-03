#!/usr/bin/env python3
"""Validate generated audit provenance and source immutability; no upstream writes."""
from pathlib import Path
import collections
import hashlib
import json
import re
BASE = Path(__file__).resolve().parent
inv = json.loads((BASE / 'upstream-inventory.json').read_text(encoding='utf-8'))
root = Path(inv['sourceRoot'])
checks = []
def check(name, condition):
    checks.append({'name': name, 'pass': bool(condition)})
    if not condition:
        raise AssertionError(name)
files = inv['files']
by_path = {f['path']: f for f in files}
check('unique file paths and full migration records', len(files) == len(by_path) and all(all(k in f for k in ('path', 'sha256', 'classification', 'migrationTarget', 'status', 'licenseEvidence', 'assetStatus')) for f in files))
check('every source file hash remains unchanged', all(hashlib.sha256((root / f['path']).read_bytes()).hexdigest() == f['sha256'] for f in files))
canonical = ''.join(f"{f['path']}\0{f['sha256']}\n" for f in sorted(files, key=lambda f: f['path']))
check('tree hash is reproducible', hashlib.sha256(canonical.encode('utf-8')).hexdigest() == inv['summary']['sourceTreeSha256'])
check('Git commit not invented', inv['git']['commit'] is None and not inv['git']['dotGitPresent'])
check('financial distinct names derived from real SKILL frontmatter', len({s['name'] for s in inv['skills'] if s['family'] != 'office-admin'}) == 63)
check('office-admin verify excluded from financial names', len([s for s in inv['skills'] if s['family'] == 'office-admin']) == 1)
check('all complete directory hashes recompute', all(hashlib.sha256(''.join(f"{f['path']}\0{f['sha256']}\n" for f in s['files']).encode('utf-8')).hexdigest() == s['treeSha256'] for s in inv['skills']))
check('all same-name role copies are compared', all(len(g['comparisons']) == g['occurrences'] * (g['occurrences'] - 1) // 2 for g in inv['skillGroups']))
check('all reference source hashes trace to inventory', all(r['sourcePath'] in by_path and r['sourceSha256'] == by_path[r['sourcePath']]['sha256'] for r in inv['assetReferences']))
check('all resolved-file hashes trace to inventory', all(r['resolvedPath'] in by_path and r['resolvedSha256'] == by_path[r['resolvedPath']]['sha256'] for r in inv['assetReferences'] if r['status'] == 'RESOLVED_FILE'))
refs = [r for r in inv['assetReferences'] if r['kind'] == 'manifest-reference' and r['sourcePath'].startswith('managed-agent-cookbooks/')]
check('YAML block and inline cross references resolved', len(refs) >= 50 and all(r['status'] in ('RESOLVED_FILE', 'RESOLVED_DIRECTORY') for r in refs))
missing = [r for r in inv['assetReferences'] if r['status'] == 'MISSING_LOCAL_REFERENCE']
check('missing evidence matches four independently reviewed reference families', {r['rawReference'] for r in missing} == {'./claude-for-financial-advisors', 'examples/comps_example.xlsx', 'examples/LBO_Model.xlsx', 'examples/Nike_Strip_Profile_Example.pptx'} and len(missing) == 12)
check('missing references include attempted source-relative locations', all(r['attemptedSourceRelativePaths'] for r in missing))
check('all commercial MCP declarations remain unverified', len(inv['mcpIntegrations']) == 14 and all(m['authorized'] == 'NOT_VERIFIED' and m['dataQueryVerified'] is False for m in inv['mcpIntegrations']))
check('all license file hashes trace to full inventory', len(inv['licenseFiles']) == 6 and all(l['sha256'] == by_path[l['path']]['sha256'] for l in inv['licenseFiles']))
check('no source symlink or junction was followed', not inv['summary']['skipped'])
check('required reports exist', all((BASE / n).is_file() for n in ('SKILL_VARIANTS.md', 'LICENSE_AUDIT.md', 'ASSET_AUDIT.md')))
result = {'status': 'PASS', 'checksPassed': len(checks), 'checks': checks, 'sourceTreeSha256': inv['summary']['sourceTreeSha256'], 'manifestReferenceCount': len(refs), 'missingLocalReferenceCount': len(missing)}
(BASE / 'audit-validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
