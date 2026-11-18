import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password="YOUR_SSH_PASSWORD_HERE", timeout=30)

cmds = [
    "ls -la ~/www 2>/dev/null | head -60",
    "ls -la ~/www/id.assistix.org 2>/dev/null | head -60",
    "find ~/www -maxdepth 3 -type d -iname '*id*' 2>/dev/null | head -40",
    "find ~/www -maxdepth 5 -name 'oauth*.php' 2>/dev/null | head -40",
    "find ~/www -maxdepth 5 -name 'bootstrap-login.php' 2>/dev/null | head -20",
    "find ~/www -maxdepth 5 -name 'exchange.php' 2>/dev/null | head -20",
    "find ~ -maxdepth 4 -type d -iname '*assistix*' 2>/dev/null | head -40",
]

for cmd in cmds:
    print("====", cmd)
    stdin, stdout, stderr = c.exec_command(cmd, timeout=90)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err:
        print("ERR", err[:500])

c.close()
