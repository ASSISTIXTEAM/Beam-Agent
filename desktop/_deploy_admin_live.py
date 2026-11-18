#!/usr/bin/env python3
"""Deploy ASSISTIX Control wired to live chat.assistix.org DB + logo + moderation gate."""
from __future__ import annotations

import os
import time
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
REMOTE_ADMIN = "/var/www/u3354161/data/www/assistix.org/admin"
REMOTE_CHAT = "/var/www/u3354161/data/www/chat.assistix.org"
LOCAL = Path(__file__).resolve().parent / "_admin_v2"
BACKUP = f"/var/www/u3354161/data/www/assistix.org/_admin_backup_{time.strftime('%Y%m%d_%H%M%S')}"

FILES = [
    "credentials.php",
    "auth_check.php",
    "login.php",
    "logout.php",
    "index.php",
    "api.php",
    "chat_db.php",
    ".htaccess",
    "assets/admin.css",
    "assets/admin.js",
]


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

    stdin, stdout, stderr = c.exec_command(
        f"mkdir -p {BACKUP} && cp -a {REMOTE_ADMIN}/. {BACKUP}/ && echo BACKED_UP"
    )
    print(stdout.read().decode(), stderr.read().decode()[:200])

    sftp = c.open_sftp()
    ensure_dir(sftp, REMOTE_ADMIN + "/assets")
    ensure_dir(sftp, REMOTE_ADMIN + "/api")

    for rel in FILES:
        local = LOCAL / rel
        if not local.exists():
            print("SKIP missing", rel)
            continue
        remote = f"{REMOTE_ADMIN}/{rel}"
        ensure_dir(sftp, str(Path(remote).parent).replace("\\", "/"))
        sftp.put(str(local), remote)
        print("put", rel)

    # Logo: prefer chat favicon (square mark), fallback logo.svg
    logo_remote = f"{REMOTE_ADMIN}/assets/assistix-mark.svg"
    for src in (
        f"{REMOTE_CHAT}/favicon.svg",
        f"{REMOTE_CHAT}/logo.svg",
        "/var/www/u3354161/data/www/assistix.org/logo.svg",
    ):
        try:
            sftp.stat(src)
            stdin, stdout, stderr = c.exec_command(f"cp -f {src} {logo_remote} && echo LOGO_OK")
            out = stdout.read().decode().strip()
            print("logo from", src, out)
            if "LOGO_OK" in out:
                break
        except Exception as e:
            print("logo skip", src, e)

    # Keep beam-ingest
    ingest_src = Path(__file__).resolve().parent / "_admin_remote" / "api" / "beam-ingest.php"
    if ingest_src.exists():
        sftp.put(str(ingest_src), f"{REMOTE_ADMIN}/api/beam-ingest.php")
        print("put api/beam-ingest.php")

    # Chat moderation gate
    gate_local = LOCAL / "_chat_moderation_gate.php"
    gate_remote = f"{REMOTE_CHAT}/lib/moderation_gate.php"
    sftp.put(str(gate_local), gate_remote)
    print("put chat lib/moderation_gate.php")

    # Patch chat api/_boot.php acx_logged_user to enforce gate + set authed_at on session use
    boot = f"{REMOTE_CHAT}/api/_boot.php"
    stdin, stdout, stderr = c.exec_command(f"cp -a {boot} {boot}.bak-moderation-$(date +%Y%m%d%H%M%S)")
    stdout.read()

    patch_php = r'''<?php
$boot = '/var/www/u3354161/data/www/chat.assistix.org/api/_boot.php';
$src = file_get_contents($boot);
if (str_contains($src, 'acx_moderation_gate')) {
    echo "ALREADY_PATCHED\n";
    exit(0);
}
if (!str_contains($src, 'function acx_logged_user')) {
    fwrite(STDERR, "no acx_logged_user\n");
    exit(1);
}
$require = "require_once dirname(__DIR__) . '/lib/moderation_gate.php';\n";
if (!str_contains($src, "moderation_gate.php")) {
    $src = str_replace(
        "require_once dirname(__DIR__) . '/lib/db.php';",
        "require_once dirname(__DIR__) . '/lib/db.php';\n" . $require,
        $src
    );
}
$newFn = <<<'PHP'
/** @return array{internal_id:int, id_user_id:int, email:string, display_name:string, avatar_url:string, subscription_tier:string}|null */
function acx_logged_user(): ?array
{
    if (empty($_SESSION['acx_user']) || !is_array($_SESSION['acx_user'])) {
        return null;
    }
    $u = $_SESSION['acx_user'];
    if (empty($u['internal_id']) || empty($u['id_user_id'])) {
        return null;
    }
    if (empty($_SESSION['acx_user']['authed_at'])) {
        $_SESSION['acx_user']['authed_at'] = time();
    }
    $user = [
        'internal_id' => (int) $u['internal_id'],
        'id_user_id' => (int) $u['id_user_id'],
        'email' => (string) ($u['email'] ?? ''),
        'display_name' => (string) ($u['display_name'] ?? ''),
        'avatar_url' => (string) ($u['avatar_url'] ?? ''),
        'subscription_tier' => (string) ($u['subscription_tier'] ?? 'free'),
    ];
    return function_exists('acx_moderation_gate') ? acx_moderation_gate($user) : $user;
}
PHP;
# replace existing function block (non-greedy until next function)
$patched = preg_replace(
    '/\/\*\* @return array\{internal_id:int.*?function acx_logged_user\(\): \?array\s*\{.*?\n\}\n/s',
    $newFn . "\n",
    $src,
    1,
    $count
);
if (!$count) {
    // fallback: simpler replace from function to closing brace before acx_is_guest
    $patched = preg_replace(
        '/function acx_logged_user\(\): \?array\s*\{.*?\n\}\n(?=\s*function acx_is_guest_mode)/s',
        preg_replace('/^\/\*\*.*?\*\/\n/s', '', $newFn) . "\n",
        $src,
        1,
        $count2
    );
    if (!$count2) {
        fwrite(STDERR, "PATCH_FAILED\n");
        exit(1);
    }
}
file_put_contents($boot, $patched);
echo "PATCHED_BOOT\n";
'''
    with sftp.file("/tmp/beam_patch_boot.php", "w") as f:
        f.write(patch_php)
    stdin, stdout, stderr = c.exec_command("php /tmp/beam_patch_boot.php; rm -f /tmp/beam_patch_boot.php")
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err.strip():
        print("PATCH ERR:", err[:800])

    # Also stamp authed_at in auth callback session assignment if possible
    cb = f"{REMOTE_CHAT}/auth/callback.php"
    stdin, stdout, stderr = c.exec_command(
        r"""python3 - <<'PY'
from pathlib import Path
p = Path('/var/www/u3354161/data/www/chat.assistix.org/auth/callback.php')
s = p.read_text(encoding='utf-8', errors='replace')
if 'authed_at' in s:
    print('CALLBACK_ALREADY')
else:
    old = "$_SESSION['acx_user'] = $sessionUser;"
    new = "$_SESSION['acx_user'] = $sessionUser;\n$_SESSION['acx_user']['authed_at'] = time();"
    if old in s:
        p.write_text(s.replace(old, new, 1), encoding='utf-8')
        print('CALLBACK_PATCHED')
    else:
        print('CALLBACK_SKIP')
PY"""
    )
    print(stdout.read().decode(), stderr.read().decode()[:300])

    sftp.close()

    # Verify API overview with login session simulation via PHP CLI
    verify = r'''<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/admin/api.php?action=overview';
$_GET['action'] = 'overview';
session_start();
$_SESSION['admin_logged_in'] = true;
$_SESSION['admin_username'] = 'beam.ops';
$_SESSION['admin_display'] = 'Beam Ops';
ob_start();
require '/var/www/u3354161/data/www/assistix.org/admin/api.php';
$out = ob_get_clean();
$j = json_decode($out, true);
if (!$j || empty($j['ok'])) { echo "FAIL\n"; echo substr($out,0,1200); exit(1); }
$s = $j['data']['stats'];
echo "OK users={$s['users']} chats={$s['chats']} msgs={$s['msgs']} apiRequests={$s['apiRequests']} idAccounts={$s['idAccounts']} source={$s['source']}\n";
if (!empty($j['data']['recentUsers'][0])) {
  echo "sample_user=", json_encode($j['data']['recentUsers'][0], JSON_UNESCAPED_UNICODE), "\n";
}
if (!empty($j['data']['recentChats'][0])) {
  echo "sample_chat=", json_encode($j['data']['recentChats'][0], JSON_UNESCAPED_UNICODE), "\n";
}
'''
    sftp = c.open_sftp()
    with sftp.file("/tmp/beam_verify_admin.php", "w") as f:
        f.write(verify)
    sftp.close()

    stdin, stdout, stderr = c.exec_command("php /tmp/beam_verify_admin.php; rm -f /tmp/beam_verify_admin.php")
    print("VERIFY:", stdout.read().decode())
    print(stderr.read().decode()[:800])

    # HTTP smoke
    for url in (
        "https://assistix.org/admin/login.php",
        "https://assistix.org/admin/assets/assistix-mark.svg",
        "https://assistix.org/admin/assets/admin.js?v=3",
    ):
        stdin, stdout, stderr = c.exec_command(f"curl -sS -o /tmp/a.out -w '%{{http_code}}' {url}")
        print(url, stdout.read().decode(), stderr.read().decode()[:120])

    # Confirm ingest still present
    stdin, stdout, stderr = c.exec_command(
        f"test -f {REMOTE_ADMIN}/api/beam-ingest.php && echo INGEST_OK || echo INGEST_MISSING"
    )
    print(stdout.read().decode())

    c.close()
    print("DEPLOYED live admin →", REMOTE_ADMIN)
    print("BACKUP →", BACKUP)


if __name__ == "__main__":
    main()
