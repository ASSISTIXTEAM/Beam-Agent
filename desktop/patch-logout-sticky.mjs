/**
 * Fix sticky Assistix session blocking logout (Выйти).
 *
 * Root cause: stickySigned kept the last signed-in user even after
 * /assistix/logout cleared bridge state, because refresh({ force:true })
 * without allowSignOut re-applied stickySigned.
 *
 * Logout must:
 *  1) POST /assistix/logout first (clear tokens/session on disk)
 *  2) Clear stickySigned + lastData immediately
 *  3) refresh({ force:true, allowSignOut:true }) so UI returns to ASSISTIX ID gate
 *  4) Hold a short signOutLock so the 1.2s auth poll cannot re-stick the wrong user
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.USERPROFILE || process.env.HOME || "";

const targets = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  path.join(HOME, "BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(HOME, "BeamAgent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  path.join(HOME, "AppData/Local/Programs/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(HOME, "AppData/Local/Programs/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
];

const MARK = "/* BEAM_LOGOUT_STICKY_FIX */";
const LOCK_MARK = "/* BEAM_SIGNOUT_LOCK */";

const GOOD_LOGOUT = `${MARK}
          try {
            await fetch(BRIDGE + "/assistix/logout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ confirm: true }),
            });
          } catch {}
          stickySigned = null;
          signOutLockUntil = Date.now() + 8000;
          lastData = { signedIn: false, user: null, pendingUser: null, authWaiting: false, lastAuthError: null, quotas: (lastData && lastData.quotas) || {}, models: (lastData && lastData.models) || [] };
          try { window.__beamAssistixStatus = lastData; } catch {}
          await refresh({ force: true, allowSignOut: true });
          try { ensureAuthGate(lastData, { force: true }); } catch {}`;

function ensureSignOutLock(s) {
  if (s.includes(LOCK_MARK)) return s;
  if (!s.includes("let stickySigned = null")) return s;
  return s.replace(
    "let stickySigned = null; // last confirmed signed-in payload",
    `let stickySigned = null; // last confirmed signed-in payload
  ${LOCK_MARK}
  let signOutLockUntil = 0; // ms epoch — block sticky re-apply after logout`,
  );
}

function hardenStickyBranch(s) {
  // When sticky would re-apply a signed-in user, respect sign-out lock.
  const old = `} else if (stickySigned && !opts.allowSignOut) {
        lastData = { ...stickySigned, quotas: next.quotas || stickySigned.quotas, models: next.models || stickySigned.models, quotaServer: next.quotaServer || stickySigned.quotaServer, bridgeDown: false, authWaiting: !!next.authWaiting, pendingUser: next.pendingUser || null };
      } else {
        stickySigned = null;
        lastData = next;
      }`;
  const neu = `} else if (stickySigned && !opts.allowSignOut && Date.now() < signOutLockUntil) {
        stickySigned = null;
        lastData = next;
      } else if (stickySigned && !opts.allowSignOut) {
        lastData = { ...stickySigned, quotas: next.quotas || stickySigned.quotas, models: next.models || stickySigned.models, quotaServer: next.quotaServer || stickySigned.quotaServer, bridgeDown: false, authWaiting: !!next.authWaiting, pendingUser: next.pendingUser || null };
      } else {
        stickySigned = null;
        lastData = next;
      }`;
  if (s.includes("Date.now() < signOutLockUntil")) return s;
  if (s.includes(old)) return s.replace(old, neu);
  return s;
}

function hardenSignedApply(s) {
  // Replace any prior signed-apply / lock variant with a race-safe block:
  // during signOutLock, never accept a leftover signed payload into the UI.
  const neu = `if (Date.now() < signOutLockUntil && !opts.fromLogin && !opts.allowSignOut) {
        stickySigned = null;
        lastData = isSignedPayload(next)
          ? { ...next, signedIn: false, user: null, pendingUser: null, authWaiting: false }
          : next;
      } else if (isSignedPayload(next)) {
        stickySigned = next;
        lastData = next;
        signOutLockUntil = 0;
      }`;

  // Newest broken/partial form from earlier patch
  const variants = [
    `if (isSignedPayload(next) && !(Date.now() < signOutLockUntil && !opts.allowSignOut && opts._hydrate !== true && !opts.fromLogin)) {
        if (Date.now() < signOutLockUntil && !opts.fromLogin) {
          // Bridge still has a leftover session right after logout — do not re-stick.
          stickySigned = null;
          lastData = { ...next, signedIn: false, user: null, pendingUser: null, authWaiting: false };
        } else {
          stickySigned = next;
          lastData = next;
          signOutLockUntil = 0;
        }
      }`,
    `if (Date.now() < signOutLockUntil && !opts.fromLogin && !opts.allowSignOut) {
        stickySigned = null;
        lastData = isSignedPayload(next)
          ? { ...next, signedIn: false, user: null, pendingUser: null, authWaiting: false }
          : next;
      } else if (isSignedPayload(next)) {
        stickySigned = next;
        lastData = next;
        signOutLockUntil = 0;
      }`,
    `if (isSignedPayload(next)) {
        stickySigned = next;
        lastData = next;
      }`,
  ];
  if (s.includes("Date.now() < signOutLockUntil && !opts.fromLogin && !opts.allowSignOut")) {
    // Already has race-safe form — still normalize from partial variants above
  }
  for (const old of variants) {
    if (old !== neu && s.includes(old)) return s.replace(old, neu);
  }
  return s;
}

function patchLogoutHandlers(s) {
  // Broken installed: fetch logout then refresh({ force:true }) — no sticky clear
  s = s.replace(
    /try \{ await fetch\(BRIDGE \+ "\/assistix\/logout", \{ method: "POST" \}\); \} catch \{\}\r?\n(\s*)refresh\(\{ force: true \}\);/g,
    GOOD_LOGOUT,
  );
  // Partial fix: sticky clear BEFORE logout (race with auth poll)
  s = s.replace(
    /stickySigned = null;\r?\n(\s*)lastData = \{ signedIn: false, user: null, pendingUser: null, authWaiting: false, lastAuthError: null, quotas: \(lastData && lastData\.quotas\) \|\| \{\}, models: \(lastData && lastData\.models\) \|\| \[\] \};\r?\n\1try \{ await fetch\(BRIDGE \+ "\/assistix\/logout", \{ method: "POST" \}\); \} catch \{\}\r?\n\1await refresh\(\{ force: true, allowSignOut: true \}\);/g,
    GOOD_LOGOUT,
  );
  // Upgrade older MARK blocks that still POST logout without confirm body
  s = s.replace(
    /\/\* BEAM_LOGOUT_STICKY_FIX \*\/\n\s*try \{[\s\S]*?await refresh\(\{ force: true, allowSignOut: true \}\);\n\s*try \{ ensureAuthGate\(lastData, \{ force: true \}\); \} catch \{\}/g,
    GOOD_LOGOUT,
  );
  if (!s.includes("JSON.stringify({ confirm: true })")) {
    s = s.replace(
      /await fetch\(BRIDGE \+ "\/assistix\/logout", \{ method: "POST" \}\);/g,
      'await fetch(BRIDGE + "/assistix/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });',
    );
  }
  if (!s.includes(MARK)) {
    s = s.replace(
      /\(async \(\) => \{\r?\n(\s*)try \{ await fetch\(BRIDGE \+ "\/assistix\/logout", \{ method: "POST"(?:,[^}]*)? \}\); \} catch \{\}\r?\n\1(?:await )?refresh\(\{ force: true(?:, allowSignOut: true)? \}\);\r?\n\1\}\)\(\);/g,
      `(async () => {\n$1${GOOD_LOGOUT}\n$1})();`,
    );
  }
  s = s.replace(
    /__beamRefreshAssistix\(\{ force: true \}\)/g,
    "__beamRefreshAssistix({ force: true, allowSignOut: true })",
  );
  return s;
}

function clearSignOutLockOnLogin(s) {
  // Password login success should lift the lock
  if (s.includes("signOutLockUntil = 0; // login ok")) return s;
  // After successful password login refresh paths commonly set lastData from status;
  // also clear lock when mounting signed gate.
  const anchor = "gate.dataset.mode = \"signed\";";
  if (!s.includes(anchor)) return s;
  return s.replace(
    anchor,
    `gate.dataset.mode = "signed";\n      signOutLockUntil = 0; // login ok`,
  );
}

function patch(file) {
  if (!fs.existsSync(file)) return { ok: false, reason: "missing" };
  const raw = fs.readFileSync(file, "utf8");
  if (!raw.includes("stickySigned") || !raw.includes("/assistix/logout")) {
    return { ok: false, reason: "no-auth-inject" };
  }
  const crlf = raw.includes("\r\n");
  let s = raw.replace(/\r\n/g, "\n");
  const before = s;
  s = ensureSignOutLock(s);
  s = patchLogoutHandlers(s);
  s = hardenStickyBranch(s);
  s = hardenSignedApply(s);
  s = clearSignOutLockOnLogin(s);
  if (s === before) {
    const already = s.includes(MARK) && s.includes("signOutLockUntil")
      && s.includes("Date.now() < signOutLockUntil && !opts.fromLogin && !opts.allowSignOut");
    return { ok: already, reason: already ? "already" : "no-match" };
  }
  if (crlf) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(file, s);
  return { ok: true, reason: "patched" };
}

let n = 0;
for (const f of targets) {
  const r = patch(f);
  console.log(r.reason, f);
  if (r.ok && r.reason === "patched") n++;
}
console.log("logout sticky fix applied to", n, "files");
