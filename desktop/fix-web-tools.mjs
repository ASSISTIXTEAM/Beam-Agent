/**
 * Fix Beam Agent web_search / web_fetch runtime failures after DeepSeek detach.
 *
 * Root causes observed on this machine:
 * 1) web_fetch → WEB_BLOCKED_URL: VPN/Clash fake-ip DNS returns 198.18.0.0/15,
 *    which ipaddr.js marks as "reserved" (not "unicast"), so SSRF gate blocks
 *    every public hostname even though TUN routing can reach the sites.
 * 2) web_search → WEB_PROVIDER_ERROR: assistix-official search still POSTs to
 *    https://api.deepseek.com/anthropic/v1/messages with the local bridge key
 *    (beam-assistix-local). Chat uses 127.0.0.1:17865; search does not, and the
 *    bridge cannot emit Anthropic web_search_tool_result blocks anyway.
 *
 * Fix:
 * - Allow 198.18.0.0/15 (and carrier-grade NAT) for hostname resolution in
 *   beam-web-fetch-http while still blocking loopback/private/link-local literals.
 * - Replace native DeepSeek Messages search with a local HTML search provider
 *   (DuckDuckGo lite) that needs no API key, with retries + clear errors.
 * - Pin desktop profile web-search-deepseek so it stays keyless/local.
 *
 * Does NOT write BEAM_BASE_URL into ~/.beam/.env.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BEAM_HOME = process.env.BEAM_HOME || path.join(os.homedir(), ".beam");
const report = [];

function write(file, text) {
  fs.writeFileSync(file, text);
  report.push(path.relative(ROOT, file).replace(/\\/g, "/"));
}

function patchFile(file, fn) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after === before) return false;
  write(file, after);
  return true;
}

function realPath(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return file;
  }
}

function collect(relParts) {
  const trees = [
    path.join(ROOT, "runtime/app/beam/node_modules"),
    path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules"),
  ];
  const scopes = ["@assistix", "@deepseek-ai"];
  const out = [];
  const seen = new Set();
  for (const tree of trees) {
    for (const scope of scopes) {
      const file = path.join(tree, scope, ...relParts);
      if (!fs.existsSync(file)) continue;
      const resolved = realPath(file);
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      out.push(resolved);
    }
  }
  return out;
}

const FETCH_MARKER = "BEAM_FAKEIP_ALLOW";
const SEARCH_MARKER = "BEAM_LOCAL_HTML_SEARCH";

const PUBLIC_IP_OLD = `function isPublicIpAddress(input) {
	let parsed;
	try {
		parsed = ipaddr.parse(stripIpv6Brackets(input));
	} catch {
		return false;
	}
	if (parsed instanceof ipaddr.IPv4) return parsed.range() === "unicast";
	if (parsed.isIPv4MappedAddress()) return parsed.toIPv4Address().range() === "unicast";
	return parsed.range() === "unicast";
}`;

const PUBLIC_IP_NEW = `function isPublicIpAddress(input) {
	let parsed;
	try {
		parsed = ipaddr.parse(stripIpv6Brackets(input));
	} catch {
		return false;
	}
	/* ${FETCH_MARKER}: VPN/Clash fake-ip (198.18/15) + CGNAT are TUN-routed destinations. */
	const ipv4 = parsed instanceof ipaddr.IPv4 ? parsed : parsed.isIPv4MappedAddress() ? parsed.toIPv4Address() : null;
	if (ipv4) {
		const range = ipv4.range();
		if (range === "unicast") return true;
		if (range === "carrierGradeNat") return true;
		const bytes = ipv4.toByteArray();
		if (bytes[0] === 198 && (bytes[1] === 18 || bytes[1] === 19)) return true; // 198.18.0.0/15 fake-ip / benchmark
		return false;
	}
	return parsed.range() === "unicast";
}`;

const REQUEST_ONCE_RETRY_MARKER = "BEAM_FETCH_RETRY";
const REQUEST_ONCE_OLD = `	async requestOnce(url, signal) {
		const headers = {
			"user-agent": this.limits.userAgent,
			"accept": "text/html,application/xhtml+xml,text/*;q=0.9,application/json;q=0.8"
		};
		try {
			const route = proxyRouteFor(url);
			if (route.proxied && !isNonPublicIpLiteral(url.hostname)) return await publicHttpNetwork.requestVia(route.dispatcher, url, headers, signal);
			const addresses = await this.resolveAddresses(url.hostname, signal);
			return await publicHttpNetwork.request(url, addresses, headers, signal);
		} catch (error) {
			if (error instanceof WebError) throw error;
			throw translateAbortOrNetwork(error, signal);
		}
	}`;

const REQUEST_ONCE_NEW = `	async requestOnce(url, signal) {
		const headers = {
			"user-agent": this.limits.userAgent,
			"accept": "text/html,application/xhtml+xml,text/*;q=0.9,application/json;q=0.8"
		};
		/* ${REQUEST_ONCE_RETRY_MARKER} */
		let lastError;
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				const route = proxyRouteFor(url);
				if (route.proxied && !isNonPublicIpLiteral(url.hostname)) return await publicHttpNetwork.requestVia(route.dispatcher, url, headers, signal);
				const addresses = await this.resolveAddresses(url.hostname, signal);
				return await publicHttpNetwork.request(url, addresses, headers, signal);
			} catch (error) {
				if (error instanceof WebError) {
					if (error.code === "WEB_BLOCKED_URL" || error.code === "WEB_INVALID_URL" || error.code === "WEB_ABORTED") throw error;
					lastError = error;
				} else {
					lastError = error;
				}
				if (signal?.aborted) throw translateAbortOrNetwork(error, signal);
				if (attempt >= 3) break;
				await new Promise((r) => setTimeout(r, 250 * attempt));
			}
		}
		if (lastError instanceof WebError) throw lastError;
		throw translateAbortOrNetwork(lastError, signal);
	}`;

/** Local HTML search body injected into DeepSeekSearchProvider.search */
const LOCAL_SEARCH_IMPL = `
	available() {
		/* ${SEARCH_MARKER}: always available — no DeepSeek Messages / API key required. */
		return true;
	}
	async search(request, signal) {
		const query = String(request?.query ?? "").trim();
		if (!query) throw new WebError("web search query is empty", "WEB_PROVIDER_ERROR");
		throwIfSearchAborted(signal);
		const maxResults = Math.max(1, Math.min(Number(request?.maxResults) || 8, 12));
		let lastError;
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				const sources = await beamLocalHtmlSearch(query, maxResults, signal);
				if (sources.length === 0) throw new WebError("web search returned no results", "WEB_PROVIDER_ERROR");
				return { sources: sources.slice(0, maxResults), truncated: sources.length > maxResults };
			} catch (error) {
				if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
				if (error instanceof WebError && error.code === "WEB_ABORTED") throw error;
				lastError = error;
				if (attempt >= 3) break;
				await new Promise((r) => setTimeout(r, 300 * attempt));
			}
		}
		const detail = lastError instanceof WebError ? lastError.message : String(lastError);
		throw new WebError(\`Local web search failed after retries: \${detail}\`, "WEB_PROVIDER_ERROR", lastError === void 0 ? void 0 : { cause: lastError });
	}
`;

const LOCAL_SEARCH_HELPERS = `
/* ${SEARCH_MARKER} helpers */
async function beamLocalHtmlSearch(query, maxResults, signal) {
	const endpoint = \`https://html.duckduckgo.com/html/?q=\${encodeURIComponent(query)}\`;
	let response;
	try {
		response = await fetch(endpoint, {
			method: "GET",
			redirect: "follow",
			headers: {
				"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				"accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
				"accept-language": "en-US,en;q=0.9"
			},
			...signal !== void 0 ? { signal } : {}
		});
	} catch (error) {
		if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
		throw new WebError(\`web search request failed: \${String(error)}\`, "WEB_PROVIDER_ERROR", { cause: error });
	}
	if (!response.ok) throw new WebError(\`web search HTTP \${response.status}\`, "WEB_PROVIDER_ERROR");
	const html = await response.text();
	throwIfSearchAborted(signal);
	return parseDuckDuckGoHtml(html, maxResults);
}
function decodeDuckHref(href) {
	if (!href) return "";
	const raw = href.replace(/&amp;/g, "&");
	try {
		const abs = raw.startsWith("//") ? \`https:\${raw}\` : raw;
		const u = new URL(abs, "https://duckduckgo.com/");
		const uddg = u.searchParams.get("uddg");
		if (uddg) return uddg;
		if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
	} catch {}
	return "";
}
function stripTags(s) {
	return String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\\"").replace(/&#x27;/g, "'").replace(/\\s+/g, " ").trim();
}
function parseDuckDuckGoHtml(html, maxResults) {
	const sources = [];
	const seen = new Set();
	const blockRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\\s\\S]*?)<\\/a>/g;
	let m;
	while ((m = blockRe.exec(html)) && sources.length < maxResults) {
		const url = decodeDuckHref(m[1]);
		const title = stripTags(m[2]);
		if (!url || !/^https?:\\/\\//i.test(url) || seen.has(url)) continue;
		seen.add(url);
		const after = html.slice(m.index, m.index + 1200);
		const snipM = /class="result__snippet"[^>]*>([\\s\\S]*?)<\\/a>/.exec(after);
		const snippet = snipM ? stripTags(snipM[1]) : "";
		sources.push({
			url,
			...title ? { title } : {},
			...snippet ? { snippet } : {}
		});
	}
	if (sources.length === 0) {
		const zci = /class="zci__heading"[\\s\\S]*?href="([^"]+)"[^>]*>([\\s\\S]*?)<\\/a>[\\s\\S]*?id="zero_click_abstract"[\\s\\S]*?>([\\s\\S]*?)<\\/(?:div|p)>/i.exec(html);
		if (zci) {
			const url = zci[1].startsWith("http") ? zci[1] : \`https:\${zci[1]}\`;
			sources.push({ url, title: stripTags(zci[2]), snippet: stripTags(zci[3]).slice(0, 400) });
		}
	}
	return sources;
}
`;

function patchFetchFile(file) {
  return patchFile(file, (s) => {
    if (!s.includes(FETCH_MARKER) && s.includes("function isPublicIpAddress(input)")) {
      if (!s.includes(PUBLIC_IP_OLD)) {
        // tolerant replace of the range===unicast IPv4 line path
        s = s.replace(
          /function isPublicIpAddress\(input\) \{[\s\S]*?\n\}/,
          PUBLIC_IP_NEW
        );
      } else {
        s = s.replace(PUBLIC_IP_OLD, PUBLIC_IP_NEW);
      }
    }
    if (!s.includes(REQUEST_ONCE_RETRY_MARKER) && s.includes("async requestOnce(url, signal)")) {
      if (s.includes(REQUEST_ONCE_OLD)) {
        s = s.replace(REQUEST_ONCE_OLD, REQUEST_ONCE_NEW);
      } else {
        // softer: wrap only the try body if exact match drifted
        s = s.replace(
          /async requestOnce\(url, signal\) \{[\s\S]*?\n\t\}/,
          REQUEST_ONCE_NEW.trimStart()
        );
      }
    }
    s = s.replace(
      'throw new WebError(`URL hostname "${hostname}" resolves to a non-public IP address`, "WEB_BLOCKED_URL")',
      'throw new WebError(`URL hostname "${hostname}" resolves to a private/local IP (${entry.address}); web_fetch only allows public destinations (loopback and LAN are blocked on purpose)`, "WEB_BLOCKED_URL")'
    );
    s = s.replace(
      'throw new WebError(`URL hostname "${hostname}" resolves through NAT64 to a non-public IPv4 address`, "WEB_BLOCKED_URL")',
      'throw new WebError(`URL hostname "${hostname}" resolves through NAT64 to a private/local IPv4 (${translatedIpv4}); web_fetch only allows public destinations`, "WEB_BLOCKED_URL")'
    );
    return s;
  });
}

function patchSearchFile(file) {
  return patchFile(file, (s) => {
    if (s.includes(SEARCH_MARKER) && s.includes("beamLocalHtmlSearch")) return s;

    // Inject helpers before DeepSeekSearchProvider class
    if (!s.includes("function beamLocalHtmlSearch")) {
      const classAnchor = "var DeepSeekSearchProvider = class {";
      if (!s.includes(classAnchor)) return s;
      s = s.replace(classAnchor, `${LOCAL_SEARCH_HELPERS}\n${classAnchor}`);
    }

    // Replace available() + search() methods on the class
    s = s.replace(
      /available\(\) \{\s*const options = this\.resolveOptions\(\);[\s\S]*?\n\t\}\n\tasync search\(request, signal\) \{[\s\S]*?\n\t\}\n\t\/\*\*\s*\n\t\* Resolve one operation's authentication headers/,
      `${LOCAL_SEARCH_IMPL.trimStart()}\n\t/**\n\t* Resolve one operation's authentication headers`
    );

    // If the regex above missed (minified spacing), try a broader cut of search only
    if (!s.includes("beamLocalHtmlSearch(query")) {
      s = s.replace(
        /async search\(request, signal\) \{[\s\S]*?\n\t\}\n\tasync authHeaders/,
        `async search(request, signal) {\n\t\tconst query = String(request?.query ?? "").trim();\n\t\tif (!query) throw new WebError("web search query is empty", "WEB_PROVIDER_ERROR");\n\t\tconst maxResults = Math.max(1, Math.min(Number(request?.maxResults) || 8, 12));\n\t\tconst sources = await beamLocalHtmlSearch(query, maxResults, signal);\n\t\tif (sources.length === 0) throw new WebError("web search returned no results", "WEB_PROVIDER_ERROR");\n\t\treturn { sources: sources.slice(0, maxResults), truncated: false };\n\t}\n\tasync authHeaders`
      );
      s = s.replace(
        /available\(\) \{\s*const options = this\.resolveOptions\(\);[\s\S]*?\n\t\}/,
        `available() {\n\t\t/* ${SEARCH_MARKER} */\n\t\treturn true;\n\t}`
      );
    }

    return s;
  });
}

// --- apply fetch patches ---
for (const file of collect(["beam-web-fetch-http", "lib", "index.js"])) {
  patchFetchFile(file);
}
for (const file of collect(["dsh-web-fetch-http", "lib", "index.js"])) {
  patchFetchFile(file);
}

// --- apply search patches ---
for (const pkg of ["beam-web-search-assistix", "beam-web-search-deepseek", "dsh-web-search-deepseek"]) {
  for (const file of collect([pkg, "lib", "index.js"])) {
    patchSearchFile(file);
  }
}

// --- desktop profile: keep search plugin present (keyless local) ---
const profilePatch = path.join(BEAM_HOME, "profiles/desktop/cordis.patch.yml");
if (fs.existsSync(profilePatch)) {
  patchFile(profilePatch, (s) => {
    if (s.includes("id: web-search-deepseek") && s.includes(SEARCH_MARKER)) return s;
    if (s.includes("id: web-search-deepseek")) {
      return s.replace(
        /- id: web-search-deepseek\n(?:[\s\S]*?)(?=\n- id:|\n*$)/,
        `- id: web-search-deepseek
  name: "@assistix/beam-web-search-assistix"
  config:
    # ${SEARCH_MARKER}: local HTML search; api key unused
    apiKeyEnv: BEAM_API_KEY
`
      );
    }
    return (
      s.replace(/\s*$/, "") +
      `

- id: web
  name: "@assistix/beam-web"
  config:
    searchProvider: assistix-official
    fetchProvider: http

- id: web-search-deepseek
  name: "@assistix/beam-web-search-assistix"
  config:
    # ${SEARCH_MARKER}: local HTML search; api key unused
    apiKeyEnv: BEAM_API_KEY
`
    );
  });
}

// Scrub DEEPSEEK_SEARCH_BASE_URL from .env if someone re-added deepseek search routing
const envPath = path.join(BEAM_HOME, ".env");
if (fs.existsSync(envPath)) {
  patchFile(envPath, (text) => {
    const lines = text
      .split(/\r?\n/)
      .filter((line) => line && !/^(BEAM_BASE_URL|DEEPSEEK_SEARCH_BASE_URL|DEEPSEEK_BASE_URL)=/i.test(line));
    return lines.join("\n") + (lines.length ? "\n" : "");
  });
}

console.log("fix-web-tools patched:");
for (const f of report) console.log(" -", f);
if (report.length === 0) console.log(" - (no file changes; already applied or paths missing)");
