from ftplib import FTP

ftp = FTP()
ftp.connect("31.31.196.221", 21, timeout=30)
ftp.login("u3354161", "7oQd4Hw2eF1aJ1Cj")
ftp.set_pasv(True)

print("PWD", ftp.pwd())
print("ROOT:")
ftp.retrlines("LIST", print)

for path in [
    "/www",
    "/www/id.assistix.org",
    "/id.assistix.org",
    "/domains",
    "/domains/id.assistix.org",
    "/domains/id.assistix.org/public_html",
]:
    print("==== TRY", path)
    try:
        ftp.cwd(path)
        print("OK", ftp.pwd())
        ftp.retrlines("LIST", print)
    except Exception as e:
        print("FAIL", e)

ftp.quit()
