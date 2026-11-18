import fs from "node:fs";

const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page") || pages[0];
if (!page?.webSocketDebuggerUrl) throw new Error("no CDP page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", () => r());
  ws.addEventListener("error", (e) => j(e.error || e));
});
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}, timeoutMs = 20000) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    const t = setTimeout(() => reject(new Error("timeout " + method)), timeoutMs);
    pending.set(mid, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

await send("Runtime.enable");
await send("Page.enable");

for (let i = 0; i < 25; i++) {
  const ping = await send("Runtime.evaluate", {
    expression: "!!document.getElementById('beam-side-limits')",
    returnByValue: true,
  });
  if (ping.result?.result?.value) break;
  await new Promise((r) => setTimeout(r, 800));
}

const snap = async (name) => {
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const b64 = shot.result?.data;
  if (!b64) throw new Error("no shot " + name);
  const out = `desktop/_shot-${name}.png`;
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
  return out;
};

const probe = async (label) => {
  const res = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const label = ${JSON.stringify(label)};
      const p = document.getElementById('beam-profile-modal');
      const l = document.getElementById('beam-limits-modal');
      const side = document.getElementById('beam-side-limits');
      const panelText = (el) => (el && !el.hidden ? (el.querySelector('.bpm-panel')?.innerText || '').replace(/\\s+/g,' ').trim().slice(0,500) : null);
      const openPanel = document.querySelector('#beam-profile-modal:not([hidden]) .bpm-panel, #beam-limits-modal:not([hidden]) .bpm-panel');
      let panelBorder = null;
      if (openPanel) {
        const s = getComputedStyle(openPanel);
        panelBorder = { border: s.borderTopColor, bg: s.backgroundColor, radius: s.borderRadius };
      }
      return {
        label,
        foot: {
          ringsAct: side?.querySelector('[data-act="limits"]')?.getAttribute('data-act') || null,
          profileAct: side?.querySelector('.bsl-profile')?.getAttribute('data-act') || null,
          gear: !!side?.querySelector('.bsl-gear'),
          ringsLabel: side?.querySelector('[data-act="limits"]')?.getAttribute('aria-label') || null,
        },
        profile: {
          open: !!(p && !p.hidden),
          text: panelText(p),
          hasWeeklyRingsSection: !!(p && !p.hidden && /лимиты недели|weekly limits/i.test(p.innerText||'')),
          hasBlmCards: !!(p && !p.hidden && p.querySelector('.blm-card')),
        },
        limits: {
          open: !!(l && !l.hidden),
          text: panelText(l),
          cardCount: l && !l.hidden ? l.querySelectorAll('.blm-card').length : 0,
        },
        panelBorder,
      };
    })()`,
  });
  return res.result?.result?.value;
};

await send("Runtime.evaluate", {
  expression: `(() => {
    for (const id of ['beam-profile-modal','beam-limits-modal']) {
      const m = document.getElementById(id); if (m) { m.hidden = true; m.querySelector('.bpm-panel')?.removeAttribute('aria-modal'); }
    }
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    return true;
  })()`,
});
await new Promise((r) => setTimeout(r, 400));

await send("Runtime.evaluate", {
  expression: `document.querySelector('#beam-side-limits [data-act="profile"]')?.click(); true`,
});
await new Promise((r) => setTimeout(r, 700));
const profileState = await probe("profile");
const profileShot = await snap("profile");

await send("Runtime.evaluate", {
  expression: `document.querySelector('#beam-profile-modal [data-act="close"]')?.click(); true`,
});
await new Promise((r) => setTimeout(r, 350));

await send("Runtime.evaluate", {
  expression: `document.querySelector('#beam-side-limits [data-act="limits"]')?.click(); true`,
});
await new Promise((r) => setTimeout(r, 700));
const limitsState = await probe("limits");
const limitsShot = await snap("limits");

const ok =
  profileState?.profile?.open === true &&
  profileState?.profile?.hasWeeklyRingsSection === false &&
  profileState?.profile?.hasBlmCards === false &&
  /Профиль|Profile/i.test(profileState?.profile?.text || "") &&
  limitsState?.limits?.open === true &&
  limitsState?.limits?.cardCount === 3 &&
  /Лимиты|Limits/i.test(limitsState?.limits?.text || "") &&
  profileState?.foot?.ringsAct === "limits" &&
  profileState?.foot?.profileAct === "profile" &&
  profileState?.foot?.gear === true;

console.log(JSON.stringify({ ok, profileState, limitsState, profileShot, limitsShot }, null, 2));
ws.close();
if (!ok) process.exit(1);
