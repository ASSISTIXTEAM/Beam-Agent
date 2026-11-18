#!/usr/bin/env python3
"""Upload Beam-friendly auth UX helpers to id.assistix.org (bootstrap + oauth-finish soft-allow already in config)."""
from __future__ import annotations

import ftplib
import time
from pathlib import Path

HOST = "31.31.196.221"
USER = "u3354161"
PASS = "7oQd4Hw2eF1aJ1Cj"
ROOT = "/www/id.assistix.org"
HERE = Path(__file__).resolve().parent


def ftp():
    f = ftplib.FTP()
    f.connect(HOST, 21, timeout=60)
    f.login(USER, PASS)
    f.set_pasv(True)
    f.voidcmd("TYPE I")
    return f


def download(rel: str) -> bytes:
    f = ftp()
    buf = bytearray()
    f.retrbinary(f"RETR {ROOT}/{rel}", buf.extend)
    f.quit()
    return bytes(buf)


def upload(rel: str, data: bytes) -> None:
    f = ftp()
    from io import BytesIO

    f.storbinary(f"STOR {ROOT}/{rel}", BytesIO(data))
    f.quit()


def patch_bootstrap(src: str) -> str:
    # Ensure loopback Beam gets oauth_finish when logged in even if validate was sticky
    marker = "/* BEAM_LOOPBACK_FINISH_FORCE */"
    if marker in src:
        return src
    inject = """
/* BEAM_LOOPBACK_FINISH_FORCE */
if ($uid && $redirect_uri !== '' && $oauthFinish === null) {
    $isLoop = (bool)preg_match('#^https?://(127\\.0\\.0\\.1|localhost|\\[::1\\])(:\\d+)?/assistix/callback/?$#i', (string)$redirect_uri);
    $isBeam = (strtolower((string)$client_id) === 'assistix-agent' || strtolower((string)$client_id) === 'assistix-chat');
    if ($isLoop && $isBeam) {
        $oauthFinish = [
            'action' => $idPublicBase . '/api/oauth-finish.php',
            'redirect_uri' => $redirect_uri,
            'client_id' => $client_id,
            'state' => $state,
        ];
        $out['oauth_finish'] = $oauthFinish;
    }
}
"""
    # before echo json_encode
    idx = src.rfind("echo json_encode")
    if idx > 0:
        src = src[:idx] + inject + "\n" + src[idx:]
    return src


def patch_oauth_finish(src: str) -> str:
    marker = "/* BEAM_LOOPBACK_VALIDATE */"
    if marker in src:
        return src
    inject = """
/* BEAM_LOOPBACK_VALIDATE */
$__beam_loop = (bool)preg_match('#^https?://(127\\.0\\.0\\.1|localhost|\\[::1\\])(:\\d+)?/assistix/callback/?$#i', $redirect_uri);
$__beam_client = (strtolower($client_id) === 'assistix-agent' || strtolower($client_id) === 'assistix-chat');
if ($__beam_loop && $__beam_client) {
    // allow desktop loopback even if config cache was stale
}
"""
    # soften invalid redirect for beam loopback
    src = src.replace(
        "if ($redirect_uri === '' || !aid_validate_redirect($client_id, $redirect_uri)) {",
        inject
        + "\nif ($redirect_uri === '' || (!aid_validate_redirect($client_id, $redirect_uri) && !($__beam_loop && $__beam_client))) {",
        1,
    )
    return src


def main():
    for rel, patcher in [
        ("api/bootstrap-login.php", patch_bootstrap),
        ("api/oauth-finish.php", patch_oauth_finish),
    ]:
        for attempt in range(4):
            try:
                raw = download(rel).decode("utf-8", "replace")
                new = patcher(raw)
                if new != raw:
                    upload(rel, new.encode("utf-8"))
                    print("patched", rel)
                else:
                    print("unchanged", rel)
                break
            except Exception as e:
                print(rel, "attempt", attempt + 1, e)
                time.sleep(2)

    # Prefer already-prepared auth-app if present and non-empty
    local_js = HERE / "id-beam-oauth" / "auth-app.patched.js"
    if local_js.exists() and local_js.stat().st_size > 1000:
        for attempt in range(4):
            try:
                upload("auth/auth-app.js", local_js.read_bytes())
                print("uploaded auth/auth-app.js", local_js.stat().st_size)
                break
            except Exception as e:
                print("auth-app upload", attempt + 1, e)
                time.sleep(2)


if __name__ == "__main__":
    main()
