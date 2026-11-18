#!/usr/bin/env python3
from __future__ import annotations

import http.cookiejar
import ssl
import urllib.parse
import urllib.request

CODE = "FPRNWT"
BASE = "https://agent.assistix.org"


def main() -> None:
    ctx = ssl.create_default_context()
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(context=ctx),
    )
    opener.addheaders = [("User-Agent", "BeamPortSmoke/1")]

    # Submit invite
    data = urllib.parse.urlencode({"beta_code": CODE}).encode()
    req = urllib.request.Request(BASE + "/", data=data, method="POST")
    with opener.open(req, timeout=45) as r:
        body = r.read().decode("utf-8", "replace")
        print("POST status", r.status, "url", r.geturl(), "len", len(body))
        print("cookies", [(c.name, c.value[:16] + "…") for c in jar])

    with opener.open(BASE + "/", timeout=45) as r:
        html = r.read().decode("utf-8", "replace")
        print("GET status", r.status, "len", len(html))
        checks = [
            "ba-shell",
            "beam-app.js",
            "beam-app.css",
            "authGate",
            "ASSISTIX ID",
            "Process",
            "Tide",
            "portfix",
            "__ACX_PREAUTH__",
        ]
        for c in checks:
            print(("OK" if c in html else "MISS"), c)
        print(html[:400].replace("\n", " "))

    with opener.open(BASE + "/api/bootstrap.php", timeout=45) as r:
        print("bootstrap", r.status, r.read()[:300].decode("utf-8", "replace"))

    with opener.open(BASE + "/api/bridge.php", timeout=45) as r:
        print("bridge", r.status, r.read()[:400].decode("utf-8", "replace"))

    with opener.open(BASE + "/auth/ping.php", timeout=45) as r:
        print("ping", r.status, r.read()[:300].decode("utf-8", "replace"))


if __name__ == "__main__":
    main()
