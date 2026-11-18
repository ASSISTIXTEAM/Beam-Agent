#!/usr/bin/env python3
"""Add «Скачать Beam Agent» menu CTAs on chat.assistix.org and agent.assistix.org."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = os.environ.get("ASSISTIX_SSH_HOST", "31.31.196.221")
USER = os.environ.get("ASSISTIX_SSH_USER", "u3354161")
PASS = os.environ.get("ASSISTIX_SSH_PASS") or os.environ.get("ASSISTIX_SFTP_PASS") or "YOUR_SSH_PASSWORD_HERE"

DOWNLOAD_URL = "https://agent.assistix.org/download/"
MARKER = "<!-- beam-desktop-download-cta -->"

CTA_HTML = (
    f'{MARKER}\n'
    f'            <a class="c-side-menu-item" href="{DOWNLOAD_URL}" '
    f'target="_blank" rel="noreferrer" id="beamDesktopDownload">'
    f'<span class="ic"></span> '
    f'<span data-i18n="side.downloadBeam">Скачать Beam Agent</span></a>\n'
)

TARGETS = [
    "/var/www/u3354161/data/www/chat.assistix.org/index.html",
    "/var/www/u3354161/data/www/agent.assistix.org/index.html",
]

# Optional i18n keys in inline script dictionaries if present
I18N_SNIPPETS = [
    (
        '"side.ecosystem":',
        '"side.downloadBeam": "Скачать Beam Agent",\n    "side.ecosystem":',
    ),
    (
        "'side.ecosystem':",
        "'side.downloadBeam': 'Скачать Beam Agent',\n    'side.ecosystem':",
    ),
    (
        '"side.ecosystem": "ASSISTIX ecosystem"',
        '"side.downloadBeam": "Download Beam Agent",\n    "side.ecosystem": "ASSISTIX ecosystem"',
    ),
]


def inject(text: str) -> tuple[str, bool]:
    if MARKER in text and "beamDesktopDownload" in text:
        # refresh href / label
        start = text.find(MARKER)
        # replace from marker through closing </a>
        end = text.find("</a>", start)
        if end > start:
            end = end + len("</a>")
            # include trailing newline if present
            if end < len(text) and text[end] == "\n":
                end += 1
            text = text[:start] + CTA_HTML + text[end:]
            return text, True
        return text, False

    anchor = (
        '<a class="c-side-menu-item" href="https://assistix.org/" '
        'target="_blank" rel="noreferrer"><span class="ic"></span> '
        '<span data-i18n="side.ecosystem">ASSISTIX ecosystem</span></a>'
    )
    idx = text.find(anchor)
    if idx < 0:
        # looser match
        needle = 'data-i18n="side.ecosystem"'
        idx = text.find(needle)
        if idx < 0:
            return text, False
        # find start of this <a
        start = text.rfind("<a ", 0, idx)
        end = text.find("</a>", idx)
        if start < 0 or end < 0:
            return text, False
        end = end + len("</a>")
        text = text[: end] + "\n" + CTA_HTML + text[end:]
        changed = True
    else:
        insert_at = idx + len(anchor)
        text = text[:insert_at] + "\n" + CTA_HTML + text[insert_at:]
        changed = True

    for old, new in I18N_SNIPPETS:
        if old in text and "side.downloadBeam" not in text:
            text = text.replace(old, new, 1)
            changed = True

    return text, changed


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=60, banner_timeout=60, auth_timeout=60)
    sftp = client.open_sftp()
    snap_dir = Path(__file__).resolve().parent / "_site_cta_snap"
    snap_dir.mkdir(parents=True, exist_ok=True)

    for remote in TARGETS:
        with sftp.open(remote, "r") as f:
            raw = f.read().decode("utf-8", "replace")
        local_name = remote.replace("/", "_").lstrip("_")
        (snap_dir / (local_name + ".bak")).write_text(raw, encoding="utf-8")
        next_text, changed = inject(raw)
        if not changed:
            print("WARN: no injection point", remote)
            continue
        bak_remote = remote + ".bak-beam-download-cta"
        try:
            sftp.remove(bak_remote)
        except OSError:
            pass
        try:
            sftp.rename(remote, bak_remote)
        except OSError:
            # rewrite bak via put
            with sftp.file(bak_remote, "w") as bf:
                bf.write(raw)
        with sftp.file(remote, "w") as wf:
            wf.write(next_text)
        print("✓ CTA injected:", remote)

    sftp.close()
    client.close()
    print("Download URL:", DOWNLOAD_URL)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
