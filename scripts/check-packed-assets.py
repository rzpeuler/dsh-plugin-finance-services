"""Validate a packed Bundle, all runtime assets and the complete original source snapshot."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--phase', default='P2')
args = parser.parse_args()
assert re.fullmatch(r'P[0-6]', args.phase)
pkg = json.loads((root / 'package.json').read_text(encoding='utf-8'))
archive = root / 'dist' / ('local-dsh-financial-services-' + pkg['version'] + '.tgz')
ledger = json.loads((root / 'assets/.migration-owned.json').read_text(encoding='utf-8'))
expected = {p: digest for p, digest in ledger['files'].items() if p.startswith('assets/')}
files = {}
snapshot = None
with tarfile.open(archive, 'r:gz') as packed:
    for member in packed.getmembers():
        assert member.isfile(), member.name
        assert member.name.startswith('package/') and '..' not in member.name.split('/'), member.name
        name = member.name.removeprefix('package/')
        assert name not in files, name
        assert not any(p in name.split('/') for p in ['node_modules', 'tests', 'audit', '.env']), name
        content = packed.extractfile(member).read()
        files[name] = {'bytes': member.size, 'sha256': hashlib.sha256(content).hexdigest()}
        if name == 'assets/source-snapshot.zip':
            snapshot = content
missing = sorted(set(expected) - set(files))
allowed_metadata = {'assets/source-archive/.gitignore', 'assets/source-archive/plugins/vertical-plugins/investment-banking/.gitignore'}
mismatched = [p for p, digest in expected.items() if p in files and files[p]['sha256'] != digest]
assert set(missing) <= allowed_metadata, missing
assert not mismatched, mismatched
assert snapshot is not None
prefix = 'assets/source-archive/'
sources = {p[len(prefix):]: digest for p, digest in expected.items() if p.startswith(prefix)}
with zipfile.ZipFile(io.BytesIO(snapshot)) as full_source:
    assert len(full_source.namelist()) == len(sources) == 363
    assert set(full_source.namelist()) == set(sources)
    assert sum(item.file_size for item in full_source.infolist()) == 1981638
    for name, digest in sources.items():
        assert hashlib.sha256(full_source.read(name)).hexdigest() == digest, name
result = {'status': 'PASS', 'phase': args.phase, 'tarball': str(archive.relative_to(root)),
          'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'bytes': archive.stat().st_size,
          'fileCount': len(files), 'expectedOwnedAssets': len(expected), 'mismatchedAssets': mismatched,
          'ordinaryTreeMetadataOmissions': missing, 'sourceSnapshotFilesVerified': 363,
          'sourceSnapshotBytesVerified': 1981638, 'metadataPreservedInFullSnapshot': True,
          'files': files}
(root / 'acceptance' / (args.phase + '-packed-files.json')).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k != 'files'}, indent=2))
