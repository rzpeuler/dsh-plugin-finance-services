"""Preserve npm-omitted source metadata in a deterministic, hash-verified full snapshot."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
ledger = json.loads((root / 'assets/.migration-owned.json').read_text(encoding='utf-8'))
prefix = 'assets/source-archive/'
sources = sorted((path, digest) for path, digest in ledger['files'].items() if path.startswith(prefix))
assert len(sources) == 363, 'Full audited source snapshot must contain 363 files'
archive = root / 'assets/source-snapshot.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as target:
    for path, digest in sources:
        content = (root / path).read_bytes()
        assert hashlib.sha256(content).hexdigest() == digest, path
        member = path[len(prefix):]
        assert not member.startswith('/') and '..' not in member.split('/'), member
        info = zipfile.ZipInfo(member, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100444 << 16
        target.writestr(info, content, compresslevel=9)
with zipfile.ZipFile(archive) as target:
    assert len(target.namelist()) == len(sources)
    for path, digest in sources:
        assert hashlib.sha256(target.read(path[len(prefix):])).hexdigest() == digest, path
print('PASS: deterministic full-source ZIP preserves all 363 original paths and hashes, including .gitignore metadata')
