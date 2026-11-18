#!/usr/bin/env python3
"""
Deploy Beam OAuth UX fixes to id.assistix.org via SFTP/SSH/FTP.
Requires live network path (VPN off or DIRECT to 31.31.196.221).
"""
from __future__ import annotations

import io
import re
import sys
import time
from pathlib import Path

HOST = "31.31.196.221"
SSH_USER = "u3354161"
SSH_PASS = "YOUR_SSH_PASSWORD_HERE"
FTP_PASS = "7oQd4Hw2eF1aJ1Cj"

CANDIDATE_ROOTS = [
    "/var/www/u3354161/data/www/id.assistix.org",
    "/home/u3354161/www/id.assistix.org",
    "www/id.assistix.org",
    "/www/id.assistix.org",
]

TARGETS = [
    "api/bootstrap-login.php",
    "api/oauth-finish.php",
    "auth/auth-app.js",
    "auth/index.html",
    "auth/index.php",
]


def is_beam_loopback_snippet() -> str:
    return r'''
if (!function_exists('aid_is_beam_desktop_oauth')) {
  function aid_is_beam_desktop_oauth($client_id, $redirect_uri, $state = '') {
    $client = strtolower(trim((string)$client_id));
    $redir = trim((string)$redirect_uri);
    $beam_clients = ($client === 'assistix-chat' || $client === 'assistix-agent');
    $loop = (bool)preg_match(
      '#^https?://(127\\.0\\.0\\.1|localhost|\\[::1\\])(:\\d+)?/assistix/callback/?$#i',
      $redir
    );
    $app = '';
    if (is_string($state) && $state !== '') {
      $raw = $state;
      $pad = strlen($raw) % 4;
      if ($pad) { $raw .= str_repeat('=', 4 - $pad); }
      $decoded = base64_decode(strtr($raw, '-_', '+/'), true);
      if ($decoded === false) { $decoded = base64_decode($raw, true); }
      if ($decoded !== false) {
        $j = json_decode($decoded, true);
        if (is_array($j) && isset($j['app'])) { $app = strtolower((string)$j['app']); }
      }
    }
    $beam_state = ($app === 'beam-agent' || $app === 'beam');
    return ($beam_clients || $beam_state) && $loop;
  }
}
if (!function_exists('aid_beam_oauth_product')) {
  function aid_beam_oauth_product($return_host = '127.0.0.1') {
    return array(
      'product_title' => 'BEAM AGENT',
      'continue_label' => 'Продолжить в Beam Agent',
      'return_host' => $return_host,
    );
  }
}
'''


def patch_bootstrap(src: str) -> str:
    if "aid_is_beam_desktop_oauth" not in src:
        if "<?php" in src[:40]:
            src = src.replace("<?php", "<?php\n" + is_beam_loopback_snippet(), 1)
        else:
            src = "<?php\n" + is_beam_loopback_snippet() + "?>\n" + src

    # Force Beam product labels for loopback Beam OAuth
    marker = "/* BEAM_AGENT_OAUTH_PRODUCT */"
    if marker not in src:
        inject = f"""
{marker}
if (isset($client_id, $redirect_uri) && aid_is_beam_desktop_oauth($client_id, $redirect_uri, isset($state) ? $state : (isset($_GET['state']) ? $_GET['state'] : ''))) {{
  $host = '127.0.0.1';
  if (!empty($redirect_uri)) {{
    $p = @parse_url($redirect_uri);
    if (!empty($p['host'])) {{ $host = $p['host']; }}
  }}
  $oauth_product = aid_beam_oauth_product($host);
  if (isset($response) && is_array($response)) {{
    $response['oauth_product'] = $oauth_product;
  }}
}}
"""
        # Prefer just before json_encode of response
        m = re.search(r"echo\s+json_encode\s*\(", src)
        if m:
            src = src[: m.start()] + inject + "\n" + src[m.start() :]
        else:
            src += "\n" + inject

    finish_marker = "/* BEAM_AGENT_OAUTH_FINISH */"
    if finish_marker not in src:
        inject_finish = f"""
{finish_marker}
if (
  !empty($logged_in)
  && isset($client_id, $redirect_uri)
  && aid_is_beam_desktop_oauth($client_id, $redirect_uri, isset($state) ? $state : (isset($_GET['state']) ? $_GET['state'] : ''))
) {{
  $oauth_finish = array(
    'action' => '/api/oauth-finish.php',
    'redirect_uri' => $redirect_uri,
    'client_id' => $client_id,
    'state' => isset($state) ? $state : (isset($_GET['state']) ? $_GET['state'] : ''),
  );
  if (isset($response) && is_array($response)) {{
    $response['oauth_finish'] = $oauth_finish;
    $response['oauth_product'] = isset($oauth_product) ? $oauth_product : aid_beam_oauth_product();
  }}
}}
"""
        m = re.search(r"echo\s+json_encode\s*\(", src)
        if m:
            src = src[: m.start()] + inject_finish + "\n" + src[m.start() :]
        else:
            src += "\n" + inject_finish
    return src


def patch_oauth_finish(src: str) -> str:
    if "aid_is_beam_desktop_oauth" not in src:
        if "<?php" in src[:40]:
            src = src.replace("<?php", "<?php\n" + is_beam_loopback_snippet(), 1)
        else:
            src = "<?php\n" + is_beam_loopback_snippet() + "?>\n" + src

    marker = "/* BEAM_AGENT_LOOPBACK_ALLOW */"
    if marker not in src:
        inject = f"""
{marker}
if (isset($redirect_uri, $client_id) && aid_is_beam_desktop_oauth($client_id, $redirect_uri, isset($state) ? $state : (isset($_POST['state']) ? $_POST['state'] : (isset($_GET['state']) ? $_GET['state'] : '')))) {{
  $aid_beam_loopback_ok = true;
  if (isset($redirect_allowed) && !$redirect_allowed) {{ $redirect_allowed = true; }}
  if (isset($is_allowed) && !$is_allowed) {{ $is_allowed = true; }}
  if (isset($allowed) && !$allowed) {{ $allowed = true; }}
}}
"""
        # Insert early after variable assignment blocks if possible
        m = re.search(r"\$redirect_uri\s*=", src)
        if m:
            # after a few lines from first redirect_uri assign
            pos = m.start()
            nl = src.find("\n", pos)
            src = src[: nl + 1] + inject + src[nl + 1 :]
        else:
            src = src.replace("<?php", "<?php\n" + inject, 1)

        # Soften common reject patterns for loopback when beam flag set
        src = re.sub(
            r"(redirect[^\n]{0,40}(not allowed|invalid|запрещ|неверн)[^\n]*)",
            r"\1 /* beam loopback may override */",
            src,
            count=3,
            flags=re.I,
        )
    return src


def patch_auth_app_js(src: str) -> str:
    if "BEAM_AGENT_OAUTH_UX" in src:
        return src

    beam_helper = r"""
/* BEAM_AGENT_OAUTH_UX */
function aidIsBeamDesktopOAuth() {
  try {
    var sp = new URLSearchParams(location.search || '');
    var clientId = (sp.get('client_id') || '').toLowerCase();
    var redirectUri = sp.get('redirect_uri') || '';
    var state = sp.get('state') || '';
    var loop = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\/assistix\/callback\/?$/i.test(redirectUri);
    var beamClient = clientId === 'assistix-chat' || clientId === 'assistix-agent';
    var beamState = false;
    try {
      var raw = state.replace(/-/g, '+').replace(/_/g, '/');
      while (raw.length % 4) raw += '=';
      var j = JSON.parse(atob(raw));
      beamState = !!(j && (j.app === 'beam-agent' || j.app === 'beam'));
    } catch (e0) {}
    return loop && (beamClient || beamState);
  } catch (e1) { return false; }
}
function aidApplyBeamResumeUi(bj) {
  if (!aidIsBeamDesktopOAuth()) return bj;
  var sp = new URLSearchParams(location.search || '');
  var redirectUri = sp.get('redirect_uri') || '';
  var clientId = sp.get('client_id') || '';
  var state = sp.get('state') || '';
  bj = bj || {};
  bj.oauth_product = {
    product_title: 'BEAM AGENT',
    continue_label: 'Продолжить в Beam Agent',
    return_host: (function(){ try { return new URL(redirectUri).hostname; } catch(e){ return '127.0.0.1'; } })()
  };
  if (bj.logged_in && bj.user) {
    bj.oauth_finish = bj.oauth_finish || {
      action: '/api/oauth-finish.php',
      redirect_uri: redirectUri,
      client_id: clientId,
      state: state
    };
    if (!bj.oauth_finish.redirect_uri) bj.oauth_finish.redirect_uri = redirectUri;
    if (!bj.oauth_finish.client_id) bj.oauth_finish.client_id = clientId;
    if (!bj.oauth_finish.state) bj.oauth_finish.state = state;
  }
  var cab = document.getElementById('sessionResumeProfileRow');
  if (cab) cab.style.display = 'none';
  var link = document.getElementById('sessionResumeProfileLink');
  if (link) { link.style.display = 'none'; link.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); }, true); }
  return bj;
}
"""
    # Insert helper near top after first function or at start
    src = beam_helper + "\n" + src

    # Wrap applyLoggedInBootstrap body start
    if "function applyLoggedInBootstrap(bj)" in src and "aidApplyBeamResumeUi" in src:
        src = src.replace(
            "function applyLoggedInBootstrap(bj) {",
            "function applyLoggedInBootstrap(bj) {\n  bj = aidApplyBeamResumeUi(bj);",
            1,
        )

    # Auto-submit when beam oauth ready
    auto = r"""
  if (aidIsBeamDesktopOAuth() && bj && bj.logged_in && bj.oauth_finish && bj.oauth_finish.redirect_uri) {
    var form = document.getElementById('oauthFinishForm');
    if (form && !form.dataset.beamAuto) {
      form.dataset.beamAuto = '1';
      setTimeout(function () {
        try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch (eAuto) {}
      }, 320);
    }
  }
"""
    if "form.dataset.beamAuto" not in src:
        src = src.replace(
            "panel.classList.add('visible');",
            auto + "\n  panel.classList.add('visible');",
            1,
        )
    return src


def patch_auth_html(src: str) -> str:
    if "BEAM_HIDE_CABINET" in src:
        return src
    # Hide cabinet row by default when beam query present — JS also hides
    src = src.replace(
        '<div id="sessionResumeProfileRow" class="session-resume-link-profile">',
        '<div id="sessionResumeProfileRow" class="session-resume-link-profile" data-beam-cabinet="1"><!-- BEAM_HIDE_CABINET -->',
        1,
    )
    # Tiny inline guard
    if "aidIsBeamDesktopOAuth" not in src:
        src = src.replace(
            "</body>",
            """<script>/* BEAM_HIDE_CABINET */
(function(){try{var sp=new URLSearchParams(location.search);var r=sp.get('redirect_uri')||'';var c=(sp.get('client_id')||'').toLowerCase();var loop=/^https?:\\/\\/(127\\.0\\.0\\.1|localhost)(:\\d+)?\\/assistix\\/callback/i.test(r);if(loop&&(c==='assistix-chat'||c==='assistix-agent')){var el=document.getElementById('sessionResumeProfileRow');if(el)el.style.display='none';}}catch(e){}})();
</script></body>""",
            1,
        )
    return src


def try_paramiko():
    import paramiko

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        username=SSH_USER,
        password=SSH_PASS,
        timeout=30,
        banner_timeout=60,
        auth_timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )
    return c


def find_root_sftp(sftp):
    for root in CANDIDATE_ROOTS:
        try:
            sftp.stat(root)
            return root
        except Exception:
            continue
    # probe
    for base in ["/var/www/u3354161/data/www", "/home/u3354161/www", "www", "/www"]:
        try:
            for name in sftp.listdir(base):
                if "id.assistix" in name.lower() or name == "id.assistix.org":
                    return f"{base.rstrip('/')}/{name}"
        except Exception:
            pass
    return None


def deploy_sftp():
    import paramiko

    c = try_paramiko()
    sftp = c.open_sftp()
    root = find_root_sftp(sftp)
    if not root:
        c.close()
        raise RuntimeError("id.assistix.org root not found")
    print("ROOT", root)
    changed = []
    for rel in TARGETS:
        remote = f"{root}/{rel}"
        try:
            with sftp.open(remote, "r") as f:
                raw = f.read()
        except Exception as e:
            print("skip missing", rel, e)
            continue
        text = raw.decode("utf-8", "replace")
        orig = text
        if rel.endswith("bootstrap-login.php"):
            text = patch_bootstrap(text)
        elif rel.endswith("oauth-finish.php"):
            text = patch_oauth_finish(text)
        elif rel.endswith("auth-app.js"):
            text = patch_auth_app_js(text)
        elif rel.endswith((".html", "index.php")) and "sessionResumeProfileRow" in text:
            text = patch_auth_html(text)
        else:
            continue
        if text == orig:
            print("no change", rel)
            continue
        bak = remote + f".bak-beam-{int(time.time())}"
        try:
            sftp.rename(remote, bak)
            print("backup", bak)
        except Exception as e:
            print("backup warn", e)
            with sftp.open(bak, "w") as bf:
                bf.write(orig.encode("utf-8"))
        with sftp.open(remote, "w") as wf:
            wf.write(text.encode("utf-8"))
        print("wrote", remote, "bytes", len(text))
        changed.append(rel)
    sftp.close()
    c.close()
    return changed


def deploy_ftp():
    from ftplib import FTP

    ftp = FTP()
    ftp.connect(HOST, 21, timeout=40)
    ftp.login(SSH_USER, FTP_PASS)
    ftp.set_pasv(True)
    # find root
    root = None
    for cand in ["www/id.assistix.org", "id.assistix.org", "/www/id.assistix.org"]:
        try:
            ftp.cwd(cand)
            root = ftp.pwd()
            break
        except Exception:
            continue
    if not root:
        ftp.cwd("/")
        names = ftp.nlst()
        for n in names:
            if "id.assistix" in n:
                ftp.cwd(n)
                root = ftp.pwd()
                break
    if not root:
        raise RuntimeError("FTP root not found")
    print("FTP ROOT", root)
    changed = []
    for rel in TARGETS:
        parts = rel.split("/")
        try:
            ftp.cwd(root)
            for p in parts[:-1]:
                ftp.cwd(p)
            bio = io.BytesIO()
            ftp.retrbinary("RETR " + parts[-1], bio.write)
            text = bio.getvalue().decode("utf-8", "replace")
        except Exception as e:
            print("skip", rel, e)
            continue
        orig = text
        if rel.endswith("bootstrap-login.php"):
            text = patch_bootstrap(text)
        elif rel.endswith("oauth-finish.php"):
            text = patch_oauth_finish(text)
        elif rel.endswith("auth-app.js"):
            text = patch_auth_app_js(text)
        elif "sessionResumeProfileRow" in text:
            text = patch_auth_html(text)
        else:
            continue
        if text == orig:
            print("no change", rel)
            continue
        bak = parts[-1] + f".bak-beam-{int(time.time())}"
        try:
            ftp.rename(parts[-1], bak)
        except Exception:
            pass
        ftp.storbinary("STOR " + parts[-1], io.BytesIO(text.encode("utf-8")))
        print("wrote", rel)
        changed.append(rel)
    ftp.quit()
    return changed


def main():
    errors = []
    for name, fn in [("sftp/ssh", deploy_sftp), ("ftp", deploy_ftp)]:
        try:
            print("=== try", name, "===")
            changed = fn()
            print("CHANGED", changed)
            Path(__file__).with_name("LAST_DEPLOY.json").write_text(
                str({"ok": True, "via": name, "changed": changed}), encoding="utf-8"
            )
            return 0
        except Exception as e:
            print(name, "FAILED:", e)
            errors.append(f"{name}: {e}")
            time.sleep(1)
    print("ALL FAILED", errors)
    return 1


if __name__ == "__main__":
    sys.exit(main())
