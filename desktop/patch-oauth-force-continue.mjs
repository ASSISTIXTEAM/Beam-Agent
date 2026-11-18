/**
 * Force «Продолжить в Beam Agent» even when ID bootstrap oauth_finish is null.
 * Also block /profile cabinet dead-end inside the auth window.
 */
import fs from "node:fs";

const MAIN =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/lib/main.js";

const OLD_INJECT = `win.webContents.on("did-finish-load", () => {
		const page = win.webContents.getURL();
		if (isAssistixCallbackUrl(page)) {
			setTimeout(closeAndReturn, 600);
			return;
		}
		if (!isAssistixAuthUrl(page)) return;
		win.webContents.executeJavaScript(\`(async () => {
  try {
    const sp = new URLSearchParams(location.search);
    const redirectUri = sp.get('redirect_uri') || '';
    const clientId = sp.get('client_id') || '';
    const state = sp.get('state') || '';
    if (!redirectUri || !clientId) return;
    const bj = await fetch('/api/bootstrap-login.php?' + sp.toString(), { credentials: 'include' }).then((r) => r.json());
    const form = document.getElementById('oauthFinishForm');
    const btn = document.getElementById('oauthContinueBtn');
    const redir = document.getElementById('oauthFinishRedirectUri');
    const client = document.getElementById('oauthFinishClientId');
    const st = document.getElementById('oauthFinishState');
    const cab = document.getElementById('sessionResumeProfileRow');
    const hint = document.getElementById('sessionResumeHint');
    if (cab) cab.style.display = 'none';
    const label = document.querySelector('[data-i18n="session_resume_title"], .session-resume-title, #sessionResumeTitle');
    if (label) label.textContent = 'Вернуться в Beam Agent';
    if (!(bj && bj.logged_in && bj.user && form && btn && redir && client && st)) return;
    redir.value = (bj.oauth_finish && bj.oauth_finish.redirect_uri) || redirectUri;
    client.value = (bj.oauth_finish && bj.oauth_finish.client_id) || clientId;
    st.value = (bj.oauth_finish && bj.oauth_finish.state) || state;
    form.classList.remove('hidden');
    btn.classList.remove('hidden');
    btn.textContent = 'Продолжить в Beam Agent';
    if (hint) {
      hint.classList.remove('hidden');
      hint.textContent = 'Beam Agent ждёт вход под этим аккаунтом. Сейчас вернём вас в приложение…';
    }
    setTimeout(() => { try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch (e) {} }, 280);
  } catch (e) {}
})();\`).catch(() => {});
	});`;

const NEW_INJECT = `win.webContents.on("did-finish-load", () => {
		const page = win.webContents.getURL();
		if (isAssistixCallbackUrl(page)) {
			setTimeout(closeAndReturn, 600);
			return;
		}
		if (!isAssistixAuthUrl(page)) return;
		win.webContents.executeJavaScript(\`(async () => {
  if (window.__beamForceContinueBound) return;
  window.__beamForceContinueBound = true;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const hideCabinet = () => {
    const killers = [
      '#sessionResumeProfileRow',
      'a[href*="/profile"]',
      'a[href*="profile/"]',
      '[data-act="profile"]',
      '#sessionResumeCabinetBtn',
      '.session-resume-profile',
    ];
    for (const sel of killers) {
      document.querySelectorAll(sel).forEach((el) => {
        const t = (el.textContent || '').toLowerCase();
        if (sel.startsWith('a') || sel.includes('profile') || /кабинет|cabinet|profile/i.test(t) || sel.includes('Profile')) {
          el.style.display = 'none';
          el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
        } else if (sel.startsWith('#')) {
          el.style.display = 'none';
        }
      });
    }
    document.querySelectorAll('a,button').forEach((el) => {
      const t = (el.textContent || '').trim();
      if (/открыть кабинет/i.test(t)) {
        el.style.display = 'none';
        el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
      }
    });
  };
  const ensureFinishUi = (redirectUri, clientId, state) => {
    let form = document.getElementById('oauthFinishForm');
    let btn = document.getElementById('oauthContinueBtn');
    let redir = document.getElementById('oauthFinishRedirectUri');
    let client = document.getElementById('oauthFinishClientId');
    let st = document.getElementById('oauthFinishState');
    if (!form) {
      form = document.createElement('form');
      form.id = 'oauthFinishForm';
      form.method = 'POST';
      form.action = '/api/oauth-finish.php';
      form.innerHTML = '<input type="hidden" id="oauthFinishRedirectUri" name="redirect_uri"/>' +
        '<input type="hidden" id="oauthFinishClientId" name="client_id"/>' +
        '<input type="hidden" id="oauthFinishState" name="state"/>' +
        '<button type="submit" id="oauthContinueBtn"></button>';
      const panel = document.getElementById('sessionResumePanel') || document.body;
      panel.appendChild(form);
      redir = document.getElementById('oauthFinishRedirectUri');
      client = document.getElementById('oauthFinishClientId');
      st = document.getElementById('oauthFinishState');
      btn = document.getElementById('oauthContinueBtn');
    }
    form.classList.remove('hidden');
    form.style.display = '';
    if (redir) redir.value = redirectUri;
    if (client) client.value = clientId;
    if (st) st.value = state;
    if (btn) {
      btn.classList.remove('hidden');
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.marginTop = '12px';
      btn.style.padding = '14px 16px';
      btn.style.border = '0';
      btn.style.borderRadius = '18px';
      btn.style.fontWeight = '800';
      btn.style.cursor = 'pointer';
      btn.style.background = 'linear-gradient(135deg,#2dd4bf,#00B3BC 55%,#0f766e)';
      btn.style.color = '#042f2e';
      btn.textContent = 'Продолжить в Beam Agent';
    }
    const hint = document.getElementById('sessionResumeHint');
    if (hint) {
      hint.classList.remove('hidden');
      hint.textContent = 'Beam Agent ждёт этот аккаунт. Сейчас вернём вас в приложение…';
    }
    const label = document.querySelector('#sessionResumeTitle, .session-resume-title, [data-i18n="session_resume_title"]');
    if (label) label.textContent = 'Войти в Beam Agent';
    return { form, btn };
  };
  const postFinish = async (redirectUri, clientId, state) => {
    const body = new URLSearchParams({
      redirect_uri: redirectUri,
      client_id: clientId,
      state: state || '',
    });
    const res = await fetch('/api/oauth-finish.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
      body,
      redirect: 'manual',
    });
    const loc = res.headers.get('Location') || res.headers.get('location') || '';
    if (loc && /127\\.0\\.0\\.1:17865|localhost:17865|\\/assistix\\/callback/i.test(loc)) {
      location.href = loc;
      return true;
    }
    // Some servers return 200 HTML bounce; try form submit as fallback
    return false;
  };
  try {
    const sp = new URLSearchParams(location.search);
    const redirectUri = sp.get('redirect_uri') || '';
    const clientId = sp.get('client_id') || '';
    const state = sp.get('state') || '';
    if (!redirectUri || !clientId) return;
    for (let i = 0; i < 12; i++) {
      hideCabinet();
      let bj = null;
      try {
        bj = await fetch('/api/bootstrap-login.php?' + sp.toString(), { credentials: 'include' }).then((r) => r.json());
      } catch (e) {}
      if (bj && bj.logged_in && bj.user) {
        const finishRedirect = (bj.oauth_finish && bj.oauth_finish.redirect_uri) || redirectUri;
        const finishClient = (bj.oauth_finish && bj.oauth_finish.client_id) || clientId;
        const finishState = (bj.oauth_finish && bj.oauth_finish.state) || state;
        const { form } = ensureFinishUi(finishRedirect, finishClient, finishState);
        hideCabinet();
        const ok = await postFinish(finishRedirect, finishClient, finishState);
        if (!ok) {
          try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch (e) {}
        }
        return;
      }
      await sleep(350);
    }
  } catch (e) {}
})();\`).catch(() => {});
	});
	// Never allow cabinet/profile navigation inside auth window
	win.webContents.on("will-navigate", (event, url) => {
		try {
			const u = new URL(url);
			if (u.hostname === "id.assistix.org" && /\\/profile\\/?/i.test(u.pathname)) {
				event.preventDefault();
			}
		} catch {}
	});`;

let main = fs.readFileSync(MAIN, "utf8");

if (!main.includes("window.__beamForceContinue")) {
  if (!main.includes('btn.textContent = \'Продолжить в Beam Agent\'')) {
    throw new Error("old inject marker missing");
  }
  // Replace from did-finish-load auth inject through its closing }); before win.on("closed"
  const start = main.indexOf('win.webContents.on("did-finish-load", () => {');
  const closed = main.indexOf('win.on("closed", () => {', start);
  if (start < 0 || closed < 0) throw new Error("inject bounds not found");
  // find the did-finish-load block end: the `});` just before win.on("closed"
  const before = main.slice(0, start);
  const after = main.slice(closed);
  main = before + NEW_INJECT + "\n\t" + after;
} else {
  console.log("force continue already present");
}

// Ensure handler uses auth window not external chrome
main = main.replace(
  /if \(parsed\.protocol === "https:" && parsed\.hostname === "id\.assistix\.org"\) \{[\s\S]*?return \{ action: "deny" \};\s*\}/,
  `if (parsed.protocol === "https:" && parsed.hostname === "id.assistix.org") {
				openAssistixAuthWindow(url);
				return { action: "deny" };
			}`
);

fs.writeFileSync(MAIN, main);
console.log("force-continue", main.includes("window.__beamForceContinue"));
console.log("block profile", main.includes('/profile'));
console.log("openAssistixAuthWindow handler", (main.match(/openAssistixAuthWindow\(url\)/g) || []).length);
