/**
 * Fix auth flicker → blank screen.
 *
 * Root cause:
 * 1) Injector run() paints ensureAuthGate(lastData || {signedIn:false}) before
 *    /assistix/status restores the session → login wall flashes, then signed-in.
 * 2) MutationObserver re-runs keep re-applying guest fallback while refresh is
 *    in flight → rapid guest/signed flicker.
 * 3) Gate thrash (overflow:hidden + full overlay remount) stalls React boot;
 *    splash fail-open then hides the only boot UI → blank black window.
 *
 * Fix: wait for first status restore; never paint guest from null lastData;
 * sticky signed-in until bridge confirms signedIn:false; gate hold during boot.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function targets() {
	const rels = [
		"dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
		"runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
		path.join(process.env.USERPROFILE || "", "BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
	];
	return rels.map((r) => (path.isAbsolute(r) ? r : path.join(ROOT, r))).filter((p) => fs.existsSync(p));
}

const MARK = "/* BEAM_AUTH_SESSION_STABLE */";

const STABLE_HELPERS = `
  ${MARK}
  let authHydrated = false;
  let authHydratePromise = null;
  let stickySigned = null; // last confirmed signed-in payload
  const isSignedPayload = (d) => !!(d && d.signedIn && d.user);
  const awaitAuthHydrated = () => {
    if (authHydrated) return Promise.resolve(lastData);
    if (authHydratePromise) return authHydratePromise;
    authHydratePromise = (async () => {
      for (let i = 0; i < 20; i++) {
        try {
          await refresh({ force: true, _hydrate: true });
        } catch {}
        if (authHydrated) return lastData;
        await new Promise((r) => setTimeout(r, 120));
      }
      authHydrated = true; // stop blocking even if bridge soft-fails
      return lastData;
    })();
    return authHydratePromise;
  };
`;

function patch(file) {
	let s = fs.readFileSync(file, "utf8");
	if (s.includes(MARK) && s.includes("awaitAuthHydrated") && s.includes("stickySigned")) {
		console.log("already patched", file);
		return false;
	}
	const before = s;

	// Insert helpers after lastData declaration area — near authPollTimer
	if (!s.includes(MARK)) {
		const anchor = "  let authPollTimer = null;";
		if (!s.includes(anchor)) {
			console.warn("anchor missing", file);
			return false;
		}
		s = s.replace(anchor, anchor + STABLE_HELPERS);
	}

	// Stabilize refresh: sticky session + hydrate flag
	const oldRefreshTail = `    if (ok && next) {
      lastData = next;
      try { window.__beamBridgeDown = false; } catch {}
    } else {
      // CRITICAL: do NOT clear a known-good session on transient bridge blips
      try { window.__beamBridgeDown = true; } catch {}
      if (lastData && lastData.signedIn && lastData.user) {
        // keep lastData — stay signed in; soft reconnect only
      } else if (!lastData) {
        lastData = { signedIn: false, user: null, quotas: {}, bridgeDown: true };
      } else {
        lastData = { ...lastData, bridgeDown: true };
      }
    }
    /* beam-assistix-status-publish */
    try {
      window.__beamAssistixStatus = lastData;
      window.dispatchEvent(new CustomEvent("beam:assistix-updated"));
    } catch {}
    try {
      window.__beamRefreshAssistix = (opts) => refresh(opts || { force: true });
    } catch {}
    try {
      ensureAuthGate(lastData, { force: false });
      if (!isGateFormInteractive()) {
        renderSide(lastData);
        enhanceLimitsPage(lastData);
      }
    } catch (e) {
      console.warn("[beam] limits ui", e);
    }
  };`;

	const newRefreshTail = `    if (ok && next) {
      // Sticky signed-in: ignore flapping signedIn:false while we already have a real user,
      // unless caller forced a logout-sensitive refresh after hydrate.
      if (isSignedPayload(next)) {
        stickySigned = next;
        lastData = next;
      } else if (stickySigned && !opts.allowSignOut) {
        lastData = { ...stickySigned, quotas: next.quotas || stickySigned.quotas, models: next.models || stickySigned.models, quotaServer: next.quotaServer || stickySigned.quotaServer, bridgeDown: false, authWaiting: !!next.authWaiting, pendingUser: next.pendingUser || null };
      } else {
        stickySigned = null;
        lastData = next;
      }
      try { window.__beamBridgeDown = false; } catch {}
      authHydrated = true;
    } else {
      // CRITICAL: do NOT clear a known-good session on transient bridge blips
      try { window.__beamBridgeDown = true; } catch {}
      if (stickySigned) {
        lastData = { ...stickySigned, bridgeDown: true };
      } else if (lastData && lastData.signedIn && lastData.user) {
        // keep lastData — stay signed in; soft reconnect only
      } else if (!lastData) {
        // During hydrate, don't invent a guest logout — leave lastData null
        if (!opts._hydrate) lastData = { signedIn: false, user: null, quotas: {}, bridgeDown: true };
      } else {
        lastData = { ...lastData, bridgeDown: true };
      }
      if (opts._hydrate && (stickySigned || (lastData && lastData.signedIn))) authHydrated = true;
      if (opts._hydrate && !ok && !lastData) { /* still waiting */ }
      else if (!ok && opts._hydrate) authHydrated = true;
    }
    /* beam-assistix-status-publish */
    try {
      window.__beamAssistixStatus = lastData;
      window.dispatchEvent(new CustomEvent("beam:assistix-updated"));
    } catch {}
    try {
      window.__beamRefreshAssistix = (opts) => refresh(opts || { force: true });
    } catch {}
    try {
      // Never paint auth gate until first status restore completes
      if (!authHydrated && !opts._hydrate) return;
      if (lastData) {
        ensureAuthGate(lastData, { force: !!opts.force && !!opts.allowSignOut });
        if (!isGateFormInteractive()) {
          renderSide(lastData);
          enhanceLimitsPage(lastData);
        }
      }
    } catch (e) {
      console.warn("[beam] limits ui", e);
    }
  };`;

	if (s.includes(oldRefreshTail)) s = s.replace(oldRefreshTail, newRefreshTail);
	else if (!s.includes("stickySigned = next")) {
		console.warn("refresh tail not found", file);
	}

	// EnsureAuthGate: if not hydrated and no data, do nothing (don't guest-paint)
	const oldEnsure = `  const ensureAuthGate = (data, opts = {}) => {
    const force = !!opts.force;
    let gate = gateEl();
    const signed = !!data?.signedIn && !!data?.user;
    // Soft reconnect: if we believe we're signed in, never slam the login wall for bridgeDown
    if (signed && data?.bridgeDown) {
      if (gate) { gate.hidden = true; }
      document.documentElement.style.overflow = "";
      return true;
    }`;

	const newEnsure = `  const ensureAuthGate = (data, opts = {}) => {
    const force = !!opts.force;
    let gate = gateEl();
    // Hold gate closed until session restore — prevents guest/signed flicker
    if (!authHydrated && !isSignedPayload(data) && !data?.pendingUser && !data?.authWaiting) {
      if (gate) { gate.hidden = true; gate.dataset.mode = "hold"; }
      try { document.documentElement.style.overflow = ""; } catch {}
      return false;
    }
    const signed = !!data?.signedIn && !!data?.user;
    // Soft reconnect: if we believe we're signed in, never slam the login wall for bridgeDown
    if (signed && data?.bridgeDown) {
      if (gate) { gate.hidden = true; }
      document.documentElement.style.overflow = "";
      return true;
    }`;

	if (s.includes(oldEnsure)) s = s.replace(oldEnsure, newEnsure);
	else if (!s.includes("Hold gate closed until session restore")) {
		console.warn("ensureAuthGate head not found", file);
	}

	// run(): never fallback to signedIn:false
	s = s.replace(
		/ensureAuthGate\(lastData \|\| \{ signedIn: false \}, \{ force: langChanged \}\);/g,
		`if (authHydrated && lastData) ensureAuthGate(lastData, { force: langChanged });`,
	);

	// start(): hydrate first, then run
	const oldStart = `  const start = () => {
    run({ heavy: true });
    refresh({ force: true });
    setInterval(() => {
      if (isGateFormInteractive()) return;
      refresh({ force: false });
      run({ heavy: true });
    }, 30000);
    armAuthPoll();`;

	const newStart = `  const start = () => {
    awaitAuthHydrated().then(() => {
      run({ heavy: true });
      armAuthPoll();
    }).catch(() => {
      authHydrated = true;
      run({ heavy: true });
      armAuthPoll();
    });
    setInterval(() => {
      if (isGateFormInteractive()) return;
      refresh({ force: false });
      run({ heavy: true });
    }, 30000);`;

	if (s.includes(oldStart)) s = s.replace(oldStart, newStart);
	else if (!s.includes("awaitAuthHydrated().then")) {
		console.warn("start() not found", file);
	}

	// Soften CSS boot display fight: when [hidden], force none (append once)
	const cssFiles = [
		file.replace(/index\.html$/i, "assets/beam-override.css"),
	];
	for (const css of cssFiles) {
		if (!fs.existsSync(css)) continue;
		let c = fs.readFileSync(css, "utf8");
		const cssMark = "/* BEAM_BOOT_HIDDEN_FORCE */";
		if (!c.includes(cssMark)) {
			c += `

${cssMark}
[data-dsh-boot][hidden],
[data-beam-boot][hidden],
[class*="_boot_u7vgf"][hidden],
#beam-early-splash[hidden] {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
  height: 0 !important;
  min-height: 0 !important;
}
`;
			fs.writeFileSync(css, c);
			console.log("css patched", css);
		}
	}

	if (s !== before) {
		fs.writeFileSync(file, s);
		console.log("patched", file);
		return true;
	}
	console.log("unchanged", file);
	return false;
}

let n = 0;
for (const t of targets()) if (patch(t)) n++;
console.log("done files=", n, "targets=", targets().length);
