#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

root = Path(__file__).resolve().parent
live = root / "live"
ship = root / "ship"

boot = (live / "api" / "_boot.php").read_text(encoding="utf-8")
if "function acx_require_auth" not in boot:
    boot = boot.replace(
        "function acx_is_guest_mode(): bool\n{\n    return acx_logged_user() === null;\n}",
        """function acx_is_guest_mode(): bool
{
    // Beam Agent cloud is auth-only — unsigned users must hit acx_require_auth().
    return acx_logged_user() === null;
}

/** @return array{internal_id:int, id_user_id:int, email:string, display_name:string, avatar_url:string, subscription_tier:string} */
function acx_require_auth(): array
{
    $u = acx_logged_user();
    if ($u === null) {
        acx_json_out(['success' => false, 'error' => 'auth_required', 'login_url' => '/auth/login.php'], 401);
    }
    return $u;
}""",
    )
(ship / "api" / "_boot.php").write_text(boot, encoding="utf-8")
print("boot", len(boot))

chat = (live / "api" / "chat.php").read_text(encoding="utf-8")
needle = "$logged = acx_logged_user();\n$guestMode = $logged === null;"
insert = (
    "$logged = acx_logged_user();\n"
    "$guestMode = $logged === null;\n"
    "if ($guestMode) {\n"
    "    acx_json_out(['success' => false, 'error' => 'auth_required', 'login_url' => '/auth/login.php'], 401);\n"
    "}"
)
if needle in chat and "auth_required" not in chat[:900]:
    chat = chat.replace(needle, insert, 1)
    print("chat patched")
else:
    print("chat skip", needle in chat)
(ship / "api" / "chat.php").write_text(chat, encoding="utf-8")

stream = (live / "api" / "stream.php").read_text(encoding="utf-8")
m = re.search(r"\$guestMode = \$logged === null;", stream)
if m and "auth_required" not in stream[max(0, m.start() - 120) : m.end() + 180]:
    inject = (
        "\nif ($guestMode) {\n"
        "    http_response_code(401);\n"
        "    header('Content-Type: application/json; charset=utf-8');\n"
        "    echo json_encode(['success' => false, 'error' => 'auth_required', 'login_url' => '/auth/login.php'], JSON_UNESCAPED_UNICODE);\n"
        "    exit;\n"
        "}"
    )
    stream = stream[: m.end()] + inject + stream[m.end() :]
    print("stream patched")
else:
    print("stream skip", bool(m))
(ship / "api" / "stream.php").write_text(stream, encoding="utf-8")

oauth = (live / "lib" / "oauth.php").read_text(encoding="utf-8")
oauth = oauth.replace("'app' => 'chat'", "'app' => 'beam-agent'")
(ship / "lib" / "oauth.php").write_text(oauth, encoding="utf-8")
print("oauth ok")
