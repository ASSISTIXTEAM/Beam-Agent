import os
import paramiko

PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "31.31.196.221",
    username="u3354161",
    password=PASS,
    timeout=30,
    allow_agent=False,
    look_for_keys=False,
)
stdin, stdout, stderr = c.exec_command(
    "grep -n 'TOKEN\\|EXPECTED\\|beam-assistix\\|YOUR_' "
    "/var/www/u3354161/data/www/agent.assistix.org/api/publish-update.php | sed -n '1,30p'"
)
print(stdout.read().decode("utf-8", "replace"))
print(stderr.read().decode("utf-8", "replace")[:400])
stdin, stdout, stderr = c.exec_command(
    "sed -n '25,45p' /var/www/u3354161/data/www/agent.assistix.org/api/publish-update.php"
)
print("--- snippet ---")
print(stdout.read().decode("utf-8", "replace"))
c.close()
