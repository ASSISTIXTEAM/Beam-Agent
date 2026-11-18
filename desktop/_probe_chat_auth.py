#!/usr/bin/env python3
from __future__ import annotations

import os
import paramiko

PHP = r"""<?php
echo "=== session.php ===\n";
echo file_get_contents('/var/www/u3354161/data/www/chat.assistix.org/lib/session.php');
echo "\n=== auth dir ===\n";
passthru('ls -la /var/www/u3354161/data/www/chat.assistix.org/auth');
echo "\n=== users.php head ===\n";
echo substr(file_get_contents('/var/www/u3354161/data/www/chat.assistix.org/lib/users.php'),0,2500);
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE"), timeout=40)
sftp = c.open_sftp()
with sftp.file("/tmp/beam_chat_auth.php", "w") as f:
    f.write(PHP)
sftp.close()
stdin, stdout, stderr = c.exec_command("php /tmp/beam_chat_auth.php; rm -f /tmp/beam_chat_auth.php", timeout=60)
print(stdout.read().decode(errors="replace")[:8000])
err = stderr.read().decode(errors="replace")
if err.strip():
    print("STDERR:", err[:500])
c.close()
