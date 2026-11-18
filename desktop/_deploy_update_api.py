#!/usr/bin/env python3
"""Deploy check-update + publish-update APIs and seed updates/ from current download feed."""
from __future__ import annotations

import json
import os
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
TOKEN = os.environ.get("BEAM_UPDATE_TOKEN", "YOUR_UPDATE_TOKEN_HERE")
AGENT = "/var/www/u3354161/data/www/agent.assistix.org"
API = f"{AGENT}/api"
UPDATES = f"{AGENT}/updates"
DOWNLOAD = f"{AGENT}/download"
LOCAL_API = Path(__file__).resolve().parent / "_admin_remote" / "api"


def ensure_dir(sftp, path: str) -> None:
    parts = path.strip("/").split("/")
    cur = ""
    for p in parts:
        cur += "/" + p
        try:
            sftp.stat(cur)
        except IOError:
            sftp.mkdir(cur)


def main() -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=40)
    sftp = c.open_sftp()
    ensure_dir(sftp, API)
    ensure_dir(sftp, UPDATES)

    for name in ("check-update.php", "publish-update.php"):
        remote = f"{API}/{name}"
        sftp.put(str(LOCAL_API / name), remote)
        sftp.chmod(remote, 0o644)
        print("put", remote)

    # Seed latest-only channel from existing download package if updates empty
    seed = r"""
set -e
UPDATES='/var/www/u3354161/data/www/agent.assistix.org/updates'
DOWNLOAD='/var/www/u3354161/data/www/agent.assistix.org/download'
mkdir -p "$UPDATES"
if [ ! -f "$UPDATES/manifest.json" ]; then
  SRC=''
  for f in \
    "$DOWNLOAD/Beam-Agent-0.1.3-Early-Alpha-Setup.exe" \
    "$DOWNLOAD/Beam-Agent-Setup.exe"
  do
    if [ -f "$f" ]; then SRC="$f"; break; fi
  done
  if [ -n "$SRC" ]; then
    python3 - <<'PY'
import json, hashlib, base64, os, shutil
from pathlib import Path
download = Path('/var/www/u3354161/data/www/agent.assistix.org/download')
updates = Path('/var/www/u3354161/data/www/agent.assistix.org/updates')
updates.mkdir(parents=True, exist_ok=True)
src = None
for name in ['Beam-Agent-0.1.3-Early-Alpha-Setup.exe', 'Beam-Agent-Setup.exe']:
    p = download / name
    if p.is_file():
        src = p
        break
if not src:
    raise SystemExit('no seed package')
version = '0.1.3-early-alpha'
versioned = f'Beam-Agent-{version}-Setup.exe'
dest = updates / versioned
stable = updates / 'Beam-Agent-Setup.exe'
shutil.copy2(src, dest)
shutil.copy2(src, stable)
# prune other exe in updates
for p in updates.iterdir():
    if p.is_file() and p.suffix.lower()=='.exe' and p.name not in {versioned, 'Beam-Agent-Setup.exe'}:
        p.unlink()
data = src.read_bytes()
sha512 = base64.b64encode(hashlib.sha512(data).digest()).decode()
sha256 = hashlib.sha256(data).hexdigest()
size = len(data)
from datetime import datetime, timezone
release = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
manifest = {
  'ok': True,
  'version': version,
  'releaseDate': release,
  'notes': 'Seeded from existing Early Alpha download channel.',
  'changelog': 'Seeded from existing Early Alpha download channel.',
  'file': versioned,
  'stableFile': 'Beam-Agent-Setup.exe',
  'size': size,
  'sha512': sha512,
  'sha256': sha256,
  'downloadUrl': f'https://agent.assistix.org/updates/{versioned}',
  'channel': 'nightly',
  'minAppVersion': None,
  'feedFile': 'Beam-Agent-0.1.3-Early-Alpha-Setup.exe',
}
(updates / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('seeded', version, size)
PY
  fi
fi
# Remove clutter: older Setup builds in download/ keep only latest + feeds + index
python3 - <<'PY'
from pathlib import Path
download = Path('/var/www/u3354161/data/www/agent.assistix.org/download')
keep = {
  'Beam-Agent-0.1.3-Early-Alpha-Setup.exe',
  'Beam-Agent-Setup.exe',
  'nightly.yml', 'latest.yml', 'update-feed-meta.json',
  'index.html', 'index.php', '.htaccess',
}
for p in download.iterdir():
    if not p.is_file():
        continue
    if p.name in keep:
        continue
    if p.suffix.lower() in {'.exe', '.yml'} or p.name.endswith('.json'):
        # drop older betas
        if '0.1.0' in p.name or '0.1.1' in p.name or '0.1.2' in p.name:
            p.unlink(missing_ok=True)
            print('pruned', p.name)
print('download listing:')
for p in sorted(download.iterdir()):
    if p.is_file():
        print(p.name, p.stat().st_size)
PY
ls -la "$UPDATES" | head -20
"""
    stdin, stdout, stderr = c.exec_command(seed)
    print(stdout.read().decode("utf-8", "replace"))
    print(stderr.read().decode("utf-8", "replace"))

    for url in (
        "https://agent.assistix.org/api/check-update.php?current=0.0.0",
        "https://agent.assistix.org/api/check-update.php?current=0.1.3-early-alpha",
        "https://agent.assistix.org/updates/manifest.json",
    ):
        stdin, stdout, stderr = c.exec_command(f"curl -sS {url!r}")
        print(url, "=>", stdout.read().decode("utf-8", "replace")[:400])

    sftp.close()
    c.close()
    print("DEPLOYED update API")


if __name__ == "__main__":
    main()
