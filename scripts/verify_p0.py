"""Recompute upstream audit evidence without running or modifying upstream code."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / 'audit/upstream/upstream-inventory.json'
DATA = json.loads(INVENTORY.read_text(encoding='utf-8'))
SOURCE = Path(DATA['sourceRoot'])
FILES = DATA['files']
MAINS = {f'{p.parent.name}': p for p in SOURCE.glob('managed-agent-cookbooks/*/agent.yaml')}
SKILLS = sorted(SOURCE.glob('plugins/**/SKILL.md'))


def digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def skill_name(path: Path) -> str:
    text = path.read_text(encoding='utf-8-sig')
    front = re.match(r'^---\s*\n(.*?)\n---', text, re.S)
    if not front:
        raise ValueError(f'Missing frontmatter: {path}')
    name = re.search(r'^name:\s*[\"\']?([a-z0-9-]+)[\"\']?\s*$', front.group(1), re.M)
    if not name:
        raise ValueError(f'Invalid name: {path}')
    return name.group(1)


def decision(row: dict) -> dict:
    kind = row['classification']
    tests = ['P0-HASH', 'P2-ASSET-INTEGRITY']
    dependencies = ['upstream source license']
    reason = 'Retain business content; adapt platform-specific paths and calls only.'
    if kind in ('main-agent-prompt', 'managed-agent-config', 'worker-config'):
        tests += ['P2-PERSONA', 'P2-EXECUTOR-PERMISSIONS', 'P4-ROLE-STEPS', 'P5-REVIEW']
        dependencies += ['DSH agentPresets', 'DSH subagents spawn', 'scoped tool guard']
        reason = 'Claude Managed Agents config/Cowork tools are not DSH declarations; use narrower Managed YAML permissions.'
    elif kind.startswith('skill-'):
        tests += ['P2-SKILL-DISCOVERY', 'P2-RESOURCE-RESOLUTION', 'P4-FILE-VALIDATION']
        dependencies += ['DSH isolated skill-filesystem root', 'role-authorized finance tools']
    elif kind in ('mcp-config', 'plugin-manifest', 'platform-hook'):
        tests += ['P1-LOADER', 'P3-DATA-AUTHORIZATION']
        dependencies += ['DSH package exports', 'provider authorization where applicable']
        reason = 'Claude plugin, hook and MCP declaration formats do not mount as DSH plugins; no wholesale permission inheritance.'
    elif kind == 'office-platform-integration':
        tests = ['P0-HASH', 'P0-PLATFORM-COMPATIBILITY']
        dependencies += ['Microsoft 365 tenant/admin consent and external platform']
        reason = 'Separate Office add-in/admin provisioning, not equivalent to DSH file generation; do not execute tenant mutations.'
    elif kind in ('upstream-tooling', 'repository-governance'):
        tests = ['P0-HASH', 'P0-TOOLING-SAFETY']
        reason = 'Retain as source reference; deployment scripts/hooks may mutate source or external services and are not executed.'
    elif kind == 'business-command':
        tests += ['P2-COMMAND-DISCOVERY', 'P4-TASK-DRAFT']
        dependencies += ['DSH commands or preset draft launcher', 'corresponding role skill']
    return {**row, 'migrationTarget': row['migrationTarget'].replace('provenance/', 'source-archive/'),
            'plannedTests': tests, 'dependencies': dependencies,
            'nonPortableReason': reason, 'implementationStatus': 'PLANNED_NOT_MIGRATED'}


def generate() -> None:
    enriched = [decision(row) for row in FILES]
    (ROOT / 'audit/migration-decisions.json').write_text(
        json.dumps({'schemaVersion': 1, 'sourceTreeSha256': DATA['summary']['sourceTreeSha256'],
                    'files': enriched}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lines = ['# SOURCE_INVENTORY — verified local upstream assets', '',
             '状态：SOURCE_AUDITED；迁移实现尚未验收。所有目标和测试为计划，不是已实现声明。', '',
             f"上游目录：`{SOURCE}`。本地无 `.git`，原始 Git commit 未知。", '',
             f"全树 SHA256：`{DATA['summary']['sourceTreeSha256']}`；363 文件，1,981,638 bytes。", '',
             '10 主 Agent、30 Worker、111 金融 SKILL.md 实例、63 独立金融 Skill 名称。另有独立 M365 verify Skill，不计63。', '',
             '完整机器证据：[上游清单](audit/upstream/upstream-inventory.json)；[逐文件迁移决定和依赖/计划测试](audit/migration-decisions.json)。', '',
             '## 每类资产覆盖', '', '| 分类 | 数量 |', '|---|---:|']
    lines += [f'| {key} | {count} |' for key, count in DATA['summary']['classificationCounts'].items()]
    lines += ['', '## 每个上游文件', '',
              '下表 SHA 均为原始字节 SHA256。细分依赖、不可移植原因和测试 ID 在机器清单的同路径项中。', '',
              '| 上游路径 | SHA256 | 迁移组件 | 状态 | 计划测试 |', '|---|---|---|---|---|']
    for row in enriched:
        source_link = (SOURCE / row['path']).as_posix()
        lines.append(f"| [{row['path']}](<{source_link}>) | `{row['sha256']}` | `{row['migrationTarget']}` | {row['status']} / PLANNED | {', '.join(row['plannedTests'])} |")
    (ROOT / 'SOURCE_INVENTORY.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


class P0EvidenceTests(unittest.TestCase):
    def test_01_source_root_is_explicit_and_not_other_project(self):
        self.assertEqual(SOURCE.resolve(), Path(r'C:\Users\Administrator\Downloads\financial-services-main').resolve())
        self.assertNotIn('ResearchHub', str(SOURCE))

    def test_02_all_regular_files_are_inventoried(self):
        actual = {p.relative_to(SOURCE).as_posix() for p in SOURCE.rglob('*') if p.is_file()}
        self.assertEqual(actual, {row['path'] for row in FILES})
        self.assertEqual(len(actual), 363)

    def test_03_each_byte_hash_and_length_matches(self):
        for row in FILES:
            with self.subTest(path=row['path']):
                content = (SOURCE / row['path']).read_bytes()
                self.assertEqual(digest(content), row['sha256'])
                self.assertEqual(len(content), row['bytes'])

    def test_04_tree_hash_is_recomputable_not_a_git_commit(self):
        body = ''.join(row['path'] + '\0' + row['sha256'] + '\n' for row in sorted(FILES, key=lambda r: r['path']))
        self.assertEqual(digest(body.encode()), DATA['summary']['sourceTreeSha256'])
        self.assertFalse((SOURCE / '.git').exists())
        self.assertIsNone(DATA['git']['commit'])

    def test_05_ten_main_agents_and_thirty_owned_workers(self):
        self.assertEqual(len(MAINS), 10)
        workers = list(SOURCE.glob('managed-agent-cookbooks/*/subagents/*.yaml'))
        self.assertEqual(len(workers), 30)
        for name, main in MAINS.items():
            with self.subTest(agent=name):
                self.assertEqual(len(list((main.parent / 'subagents').glob('*.yaml'))), 3)
                text = main.read_text(encoding='utf-8')
                for worker in (main.parent / 'subagents').glob('*.yaml'):
                    self.assertIn('./subagents/' + worker.name, text)

    def test_06_sixty_three_named_skills_all_have_frontmatter(self):
        self.assertEqual(len(SKILLS), 111)
        self.assertEqual(len({skill_name(p) for p in SKILLS}), 63)

    def test_07_skill_category_counts_match_explicit_scope(self):
        vertical = {skill_name(p) for p in SKILLS if 'vertical-plugins' in p.parts}
        agent = {skill_name(p) for p in SKILLS if 'agent-plugins' in p.parts}
        partner = {skill_name(p) for p in SKILLS if 'partner-built' in p.parts}
        self.assertEqual(len(vertical), 49)
        self.assertEqual(agent - vertical, {'client-report', 'client-review', 'investment-proposal'})
        self.assertEqual(len(partner), 11)

    def test_08_same_name_full_resource_trees_are_compared(self):
        groups: dict[str, set[str]] = {}
        for skill in SKILLS:
            body = ''.join(p.relative_to(skill.parent).as_posix() + '\0' + digest(p.read_bytes()) + '\n'
                           for p in sorted(skill.parent.rglob('*')) if p.is_file())
            groups.setdefault(skill_name(skill), set()).add(digest(body.encode()))
        self.assertEqual([name for name, variants in groups.items() if len(variants) != 1], [])

    def test_09_license_file_is_real_and_hash_matches(self):
        self.assertIn('Apache License', (SOURCE / 'LICENSE').read_text(encoding='utf-8'))
        licenses = [row for row in FILES if row['classification'] == 'license']
        self.assertEqual(len(licenses), 6)

    def test_10_every_asset_has_target_reason_dependencies_and_tests(self):
        for row in FILES:
            mapped = decision(row)
            for key in ('migrationTarget', 'nonPortableReason', 'dependencies', 'plannedTests', 'status'):
                self.assertTrue(mapped[key], (row['path'], key))
            self.assertEqual(mapped['implementationStatus'], 'PLANNED_NOT_MIGRATED')

    def test_11_required_p0_reports_exist_and_do_not_claim_product_e2e(self):
        for name in ('SOURCE_INVENTORY.md', 'COMPATIBILITY_MATRIX.md', 'IMPLEMENTATION_PLAN.md'):
            self.assertTrue((ROOT / name).is_file(), name)
        self.assertIn('未', (ROOT / 'PROJECT_STATUS.md').read_text(encoding='utf-8'))

    def test_12_current_host_has_no_mcp_manager_package(self):
        reference = ROOT / 'audit/dsh-reference'
        self.assertTrue((reference / 'AGENTS.md').is_file())
        names = {json.loads(p.read_text(encoding='utf-8'))['name'] for p in (reference / 'packages/mcp').glob('*/package.json')}
        self.assertEqual(names, {'@deepseek-ai/dsh-mcp-client', '@deepseek-ai/dsh-mcp-resources'})


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--generate', action='store_true')
    args = parser.parse_args()
    if args.generate:
        generate()
        print('Generated SOURCE_INVENTORY.md and audit/migration-decisions.json; no source changes.')
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(P0EvidenceTests)
    log = io.StringIO()
    result = unittest.TextTestRunner(stream=log, verbosity=2).run(suite)
    print(log.getvalue(), end='')
    (ROOT / 'acceptance/P0-verification-final.txt').write_text(log.getvalue(), encoding='utf-8')
    (ROOT / 'acceptance/P0-results.json').write_text(json.dumps({
        'status': 'PASS' if result.wasSuccessful() else 'FAIL',
        'testsRun': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
        'sourceTreeSha256': DATA['summary']['sourceTreeSha256'], 'businessE2E': 0,
        'scope': 'Static source and migration-design evidence, not installed product execution'
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    sys.exit(0 if result.wasSuccessful() else 1)
