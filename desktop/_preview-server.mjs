import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".js": "text/javascript",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

http
  .createServer((req, res) => {
    let u = decodeURIComponent((req.url || "/").split("?")[0]);
    if (u === "/") u = "/desktop/_preview-profile-limits.html";
    const p = path.normalize(path.join(root, u.replace(/^\//, "")));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404);
      res.end("missing " + u);
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  })
  .listen(8765, "127.0.0.1", () => {
    console.log("preview http://127.0.0.1:8765/");
  });
