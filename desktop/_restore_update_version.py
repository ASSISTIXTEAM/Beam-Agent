import os, paramiko, json
PASS=os.environ.get("BP","YOUR_SSH_PASSWORD_HERE")
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=PASS, timeout=30)
cmd=r'''python3 - <<'PY2'
import json
from pathlib import Path
p=Path('/var/www/u3354161/data/www/agent.assistix.org/updates/manifest.json')
m=json.loads(p.read_text())
m['version']='0.1.3-early-alpha'
m['notes']='Beam Agent Early Alpha update channel.'
m['changelog']=m['notes']
p.write_text(json.dumps(m, indent=2, ensure_ascii=False)+'\n')
print('restored', m['version'])
PY2
curl -sS 'https://agent.assistix.org/api/check-update.php?current=0.1.3-early-alpha'
'''
stdin,stdout,stderr=c.exec_command(cmd)
print(stdout.read().decode())
print(stderr.read().decode())
c.close()
