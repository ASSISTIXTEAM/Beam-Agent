/**
 * Fix: desktop welcome: Web authentication failed
 *
 * Root cause: connectDesktopWelcome re-fetched the Host launch URL via
 * Electron net.fetch(credentials:include). That URL is one-shot and already
 * consumed by authenticateWebHost(); the Host cookie was never placed in the
 * Electron cookie jar. Second fetch → non-OK → fatal crash dialog.
 *
 * Fix: use the Host cookie from authenticateWebHost explicitly (upstream
 * pattern). Never re-hit the launch URL. Soft-fail welcome connect so a
 * transient Host blip cannot brick startup (ASSISTIX gate lives in web UI).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = [
  path.join(ROOT, "runtime", "app", "lib", "main.js"),
  path.join(ROOT, "dist", "Beam Agent", "resources", "app", "lib", "main.js"),
  path.join(process.env.USERPROFILE || "", "BeamAgent", "resources", "app", "lib", "main.js"),
].filter((p) => fs.existsSync(p));

const OLD_FN_START = `/**
* Authenticate the native HTTP client through the Web application's launch URL.
* @param authenticatedUrl - URL supplied by the running Desktop Host.
* @param send - Electron session fetch, retaining the Web authentication cookie.
* @returns metadata reads and write-only credential operations over standard RPC.
*/
async function connectDesktopWelcome(authenticatedUrl, send, cookies = () => Promise.resolve("")) {
	const origin = new URL(authenticatedUrl).origin;
	const authenticated = await send(authenticatedUrl, { credentials: "include" });
	await authenticated.body?.cancel();
	if (!authenticated.ok) throw new Error("desktop welcome: Web authentication failed");
	const invoke = async (request, signal) => {
		const rpcId = randomUUID();
		const method = \`\${request.namespace}/\${request.method}\`;
		const response = await send(new URL(\`/api/\${method}\`, origin).href, {
			method: "POST",
			credentials: "include",
			redirect: "error",
			...signal === void 0 ? {} : { signal },
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				type: "client-request",
				rpcId,
				method,
				payload: { args: request.args }
			})
		});`;

const NEW_FN_START = `/**
* Connect the native HTTP client to the Desktop Host using the Host-issued cookie.
* Launch URL is one-shot and already consumed by authenticateWebHost — never re-fetch it.
* @param hostUrl - URL of the running Desktop Host; only its origin is used.
* @param cookie - Desktop-private authentication Cookie header for this owned Host.
* @param send - HTTP client for Host requests (defaults to global fetch).
* @returns metadata reads and write-only credential operations over standard RPC.
*/
function connectDesktopWelcome(hostUrl, cookie, send = fetch) {
	const origin = new URL(hostUrl).origin;
	const invoke = async (request, signal) => {
		const rpcId = randomUUID();
		const method = \`\${request.namespace}/\${request.method}\`;
		const response = await send(new URL(\`/api/\${method}\`, origin).href, {
			method: "POST",
			redirect: "error",
			...signal === void 0 ? {} : { signal },
			headers: {
				"content-type": "application/json",
				cookie
			},
			body: JSON.stringify({
				type: "client-request",
				rpcId,
				method,
				payload: { args: request.args }
			})
		});`;

const OLD_ACCOUNT = `	const account = desktopAccountBackend(origin, invoke, cookies);`;
const NEW_ACCOUNT = `	const account = desktopAccountBackend(origin, invoke, () => Promise.resolve(cookie));`;

const OLD_CALL = `welcomeBackend = await connectDesktopWelcome(ready.url, (input, init) => net.fetch(input, init), async () => (await session.defaultSession.cookies.get({ url: ready.url })).map((cookie) => \`\${cookie.name}=\${cookie.value}\`).join("; "));
				analyticsEnabled = await welcomeBackend.analyticsEnabled().catch(() => false);`;

const NEW_CALL = `try {
					welcomeBackend = connectDesktopWelcome(ready.url, hostCookie);
					analyticsEnabled = await welcomeBackend.analyticsEnabled().catch(() => false);
				} catch (welcomeError) {
					/* Beam: never crash the shell on welcome RPC; ASSISTIX gate is in web UI */
					console.warn("desktop welcome: connect failed; continuing with workspace defaults", welcomeError);
					welcomeBackend = {
						account: {
							state: async () => ({ status: "signed-out", attempt: null }),
							start: async () => ({ status: "signed-out", attempt: null }),
							cancel: async () => ({ status: "signed-out", attempt: null }),
							signOut: async () => ({ status: "signed-out", attempt: null }),
							watch: () => () => {}
						},
						read: async () => ({ loggedIn: true, hasApiKey: true, writable: false, localePreference: null, themePreference: "system" }),
						analyticsEnabled: async () => false,
						report: async () => {},
						readLocalePreference: async () => null,
						save: async () => ({ ok: false })
					};
					analyticsEnabled = false;
				}`;

let n = 0;
for (const file of TARGETS) {
  let s = fs.readFileSync(file, "utf8");
  const before = s;
  if (s.includes("Launch URL is one-shot and already consumed by authenticateWebHost")) {
    console.log("already patched", file);
    continue;
  }
  if (!s.includes(OLD_FN_START)) {
    console.warn("FN block not found:", file);
  } else {
    s = s.replace(OLD_FN_START, NEW_FN_START);
  }
  if (s.includes(OLD_ACCOUNT)) s = s.replace(OLD_ACCOUNT, NEW_ACCOUNT);
  if (s.includes(OLD_CALL)) s = s.replace(OLD_CALL, NEW_CALL);
  else if (!s.includes("desktop welcome: connect failed; continuing with workspace defaults")) {
    console.warn("CALL site not found:", file);
  }
  if (s !== before) {
    fs.writeFileSync(file, s);
    n++;
    console.log("patched", file);
  } else {
    console.log("unchanged", file);
  }
}
console.log("done files=", n, "targets=", TARGETS.length);
