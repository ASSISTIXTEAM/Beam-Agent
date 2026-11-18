const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page") || pages[0];
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
const evalExpr = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (res.result?.exceptionDetails) {
    return { error: res.result.exceptionDetails.text || "eval error", detail: res.result.exceptionDetails };
  }
  return res.result?.result?.value;
};

const info = await evalExpr(`(() => {
  const side = document.getElementById("beam-side-limits");
  const moreBtns = [...document.querySelectorAll("button,[role=button]")].filter((e) =>
    /^(Ещё|More)$/i.test((e.innerText || "").trim().replace(/\\s+/g, " "))
  ).map((e) => ({
    text: (e.innerText || "").trim(),
    aria: e.getAttribute("aria-label"),
    cls: String(e.className || "").slice(0, 80),
    hiddenAttr: e.getAttribute("data-beam-hidden-more"),
    display: getComputedStyle(e).display,
    opacity: getComputedStyle(e).opacity,
    inFoot: !!e.closest('[class*="footArea"],[class*="settingsArea"]'),
    rect: (() => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
  }));
  return {
    hasSide: !!side,
    sideHtml: side ? side.innerHTML.slice(0, 800) : null,
    hasGear: !!side?.querySelector(".bsl-gear"),
    hasProfile: !!side?.querySelector(".bsl-profile"),
    hasLogout: !!side?.querySelector(".bsl-logout"),
    profileAct: side?.querySelector(".bsl-profile")?.getAttribute("data-act"),
    gearAct: side?.querySelector(".bsl-gear")?.getAttribute("data-act"),
    moreBtns,
    accountTrigger: !!document.querySelector('[class*="settingsArea"] button[aria-haspopup="menu"], button._5Qcc8a_trigger'),
    accountTriggerVis: (() => {
      const t = document.querySelector('[class*="settingsArea"] button[aria-haspopup="menu"], button._5Qcc8a_trigger');
      if (!t) return null;
      const s = getComputedStyle(t);
      const r = t.getBoundingClientRect();
      return { opacity: s.opacity, display: s.display, w: Math.round(r.width), h: Math.round(r.height), text: (t.innerText||"").trim().slice(0,40), aria: t.getAttribute("aria-label") };
    })(),
    modal: !!document.getElementById("beam-profile-modal"),
  };
})()`);

console.log(JSON.stringify(info, null, 2));

// Click profile
console.log(
  "click profile",
  await evalExpr(`(() => {
    const b = document.querySelector('#beam-side-limits [data-act="profile"]');
    if (!b) return { ok: false };
    b.click();
    return { ok: true, modalHidden: document.getElementById("beam-profile-modal")?.hidden };
  })()`)
);
await new Promise((r) => setTimeout(r, 400));
console.log(
  "after profile",
  await evalExpr(`(() => {
    const m = document.getElementById("beam-profile-modal");
    return {
      exists: !!m,
      hidden: m?.hidden,
      title: m?.querySelector("#beam-profile-title")?.textContent || null,
      hasLogout: !!m?.querySelector('[data-act="logout"]'),
      hasSettings: !!m?.querySelector('[data-act="settings"]'),
    };
  })()`)
);

// Close profile, click gear
await evalExpr(`document.querySelector('#beam-profile-modal [data-act="close"]')?.click()`);
await new Promise((r) => setTimeout(r, 200));
console.log(
  "click gear",
  await evalExpr(`(() => {
    const b = document.querySelector('#beam-side-limits [data-act="settings"]');
    if (!b) return { ok: false };
    b.click();
    return { ok: true };
  })()`)
);
await new Promise((r) => setTimeout(r, 800));
console.log(
  "after gear",
  await evalExpr(`(() => {
    const settingsDlg = document.querySelector('[data-shortcut-modal="settings"]');
    const anyDlg = document.querySelector('[role="dialog"][aria-modal="true"]');
    const titles = [...document.querySelectorAll('[role="dialog"]')].map((e) => (e.innerText || "").trim().replace(/\\s+/g, " ").slice(0, 120)).filter(Boolean).slice(0, 8);
    return {
      hasSettingsDialog: !!settingsDlg,
      anyDialog: !!anyDlg,
      dialogText: ((settingsDlg || anyDlg)?.innerText || "").replace(/\\s+/g, " ").slice(0, 300),
      titles,
      menuItems: [...document.querySelectorAll('[role="menuitem"]')].map((e) => (e.innerText || "").trim()).slice(0, 10),
    };
  })()`)
);

ws.close();
