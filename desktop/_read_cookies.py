import os, shutil, sqlite3, tempfile
for label, src in [
    ("chrome", r"C:\Users\Alexa\AppData\Local\Google\Chrome\User Data\Default\Network\Cookies"),
    ("beam", r"C:\Users\Alexa\.beam\electron-userdata\Network\Cookies"),
]:
    if not os.path.exists(src):
        print(label, "missing")
        continue
    tmp = os.path.join(tempfile.gettempdir(), f"{label}_cookies_copy.db")
    shutil.copy2(src, tmp)
    con = sqlite3.connect(tmp)
    try:
        rows = con.execute(
            "select host_key,name,path,length(encrypted_value) from cookies where host_key like '%assistix%' or name like '%AID%'"
        ).fetchall()
        print(label, rows)
    except Exception as e:
        print(label, "err", e)
    finally:
        con.close()
