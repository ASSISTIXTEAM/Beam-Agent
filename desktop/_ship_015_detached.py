import json, os, sys, time
from pathlib import Path
import paramiko

HOST="31.31.196.221"; USER="u3354161"
PASS=os.environ["BP"]; TOKEN=os.environ["BEAM_UPDATE_TOKEN"]
ROOT=Path(r"C:\Users\Alexa\OneDrive\Documents\Beam Agent")
PKG=ROOT/"dist/installers/Beam-Agent-0.1.5-Setup.exe"
API="/var/www/u3354161/data/www/agent.assistix.org/api"
# Stable remote name for resume across restarts
REMOTE="/tmp/beam-015-stable-upload.exe"
LOG=ROOT/"desktop/_ship_015_detached.log"

def log(m):
    line=f"{time.strftime('%H:%M:%S')} {m}"
    print(line, flush=True)
    with open(LOG,"a",encoding="utf-8") as f: f.write(line+"\n")

def connect():
    last=None
    for i in range(1,12):
        try:
            c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            c.connect(HOST,username=USER,password=PASS,timeout=60,banner_timeout=180,auth_timeout=90,allow_agent=False,look_for_keys=False)
            sftp=c.open_sftp()
            try: sftp.get_channel().settimeout(3*60*60)
            except Exception: pass
            log(f"ssh ok {i}"); return c,sftp
        except Exception as e:
            last=e; log(f"ssh fail {i}: {e}"); time.sleep(3+i)
    raise RuntimeError(last)

def main():
    open(LOG,"w",encoding="utf-8").write("")
    total=PKG.stat().st_size
    log(f"start upload {total} -> {REMOTE}")
    c,sftp=connect()
    for name in ("check-update.php","publish-update.php"):
        text=(ROOT/"desktop/_admin_remote/api"/name).read_text(encoding="utf-8").replace("YOUR_UPDATE_TOKEN_HERE", TOKEN)
        with sftp.file(f"{API}/{name}","w") as f: f.write(text)
        log(f"api {name}")
    offset=0
    try:
        st=sftp.stat(REMOTE)
        if st.st_size==total:
            log("already complete"); offset=total
        elif 0<st.st_size<total:
            offset=st.st_size; log(f"resume {offset}")
        else:
            try: sftp.remove(REMOTE)
            except OSError: pass
            log(f"wipe stale size={getattr(st,'st_size',None)}")
    except IOError:
        pass
    if offset<total:
        with PKG.open("rb") as lf, sftp.file(REMOTE,"ab" if offset else "wb") as rf:
            if offset: lf.seek(offset)
            rf.set_pipelined(True)
            sent=offset; last=-1
            while True:
                chunk=lf.read(2*1024*1024)
                if not chunk: break
                rf.write(chunk); sent+=len(chunk)
                pct=int(sent*100/total)
                if pct!=last and (pct%2==0 or sent==total):
                    last=pct; log(f"  {sent/(1024*1024):.1f}/{total/(1024*1024):.1f} MB ({pct}%)")
            rf.flush()
    out=c.exec_command(f"stat -c%s {REMOTE}")[1].read().decode().strip()
    log(f"remote size={out} local={total}")
    if out!=str(total):
        raise RuntimeError(f"size mismatch {out}!={total}")
    body=json.dumps({"version":"0.1.5","notes":"Beam Agent 0.1.5: auth flicker/black screen fix, quota sync, reconnect, icons, tools; supersedes 0.1.3/0.1.4","channel":"nightly","packagePath":REMOTE,"file":PKG.name})
    with sftp.file("/tmp/beam-publish-015-final.json","w") as f: f.write(body)
    pub=c.exec_command("curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' -H 'Content-Type: application/json' -H 'X-Beam-Update-Token: "+TOKEN+"' --data-binary @/tmp/beam-publish-015-final.json", timeout=180)[1].read().decode()
    log("PUBLISH: "+pub)
    for q in ("0.1.3-early-alpha","0.1.4","0.1.5"):
        chk=c.exec_command(f"curl -sS 'https://agent.assistix.org/api/check-update.php?current={q}'")[1].read().decode()
        log(f"CHECK {q}: "+chk)
    feed=c.exec_command("curl -sS 'https://agent.assistix.org/download/nightly.yml'")[1].read().decode()
    log("FEED: "+feed)
    sftp.close(); c.close(); log("SHIPPED 0.1.5")

if __name__=="__main__":
    try: main()
    except Exception as e:
        log(f"FAIL: {e!r}"); raise
