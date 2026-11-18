
/* BEAM_AGENT_OAUTH_UX */
function aidIsBeamDesktopOAuth() {
  try {
    var sp = new URLSearchParams(location.search || '');
    var clientId = (sp.get('client_id') || '').toLowerCase();
    var redirectUri = sp.get('redirect_uri') || '';
    var state = sp.get('state') || '';
    var loop = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\/assistix\/callback\/?$/i.test(redirectUri);
    var beamClient = clientId === 'assistix-chat' || clientId === 'assistix-agent';
    var beamState = false;
    try {
      var raw = state.replace(/-/g, '+').replace(/_/g, '/');
      while (raw.length % 4) raw += '=';
      var j = JSON.parse(atob(raw));
      beamState = !!(j && (j.app === 'beam-agent' || j.app === 'beam'));
    } catch (e0) {}
    return loop && (beamClient || beamState);
  } catch (e1) { return false; }
}
function aidApplyBeamResumeUi(bj) {
  if (!aidIsBeamDesktopOAuth()) return bj;
  var sp = new URLSearchParams(location.search || '');
  var redirectUri = sp.get('redirect_uri') || '';
  var clientId = sp.get('client_id') || '';
  var state = sp.get('state') || '';
  bj = bj || {};
  bj.oauth_product = {
    product_title: 'BEAM AGENT',
    continue_label: 'Продолжить в Beam Agent',
    return_host: (function(){ try { return new URL(redirectUri).hostname; } catch(e){ return '127.0.0.1'; } })()
  };
  if (bj.logged_in && bj.user) {
    bj.oauth_finish = bj.oauth_finish || {
      action: '/api/oauth-finish.php',
      redirect_uri: redirectUri,
      client_id: clientId,
      state: state
    };
    if (!bj.oauth_finish.redirect_uri) bj.oauth_finish.redirect_uri = redirectUri;
    if (!bj.oauth_finish.client_id) bj.oauth_finish.client_id = clientId;
    if (!bj.oauth_finish.state) bj.oauth_finish.state = state;
  }
  var cab = document.getElementById('sessionResumeProfileRow');
  if (cab) cab.style.display = 'none';
  var link = document.getElementById('sessionResumeProfileLink');
  if (link) { link.style.display = 'none'; link.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); }, true); }
  return bj;
}

(function () {
    const sp = new URLSearchParams(location.search);
    const redirectUri = sp.get('redirect_uri') || '';
    const clientId = sp.get('client_id') || 'assistix-www';
    const state = sp.get('state') || '';

    function oauthQuery() {
        const q = new URLSearchParams();
        if (redirectUri) q.set('redirect_uri', redirectUri);
        q.set('client_id', clientId);
        if (state) q.set('state', state);
        return q.toString();
    }

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    async function safeJson(response) {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            const preview = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
            throw new Error('Ошибка сервера: ' + (preview || 'HTTP ' + response.status));
        }
    }

    function showToast(message, type) {
        type = type || 'success';
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        if (!toast || !toastMessage) return;
        toast.className = 'toast ' + type;
        toastMessage.textContent = message;
        setTimeout(function () {
            toast.classList.add('show');
        }, 100);
        setTimeout(function () {
            toast.classList.remove('show');
        }, 3200);
    }

    window.togglePassword = function () {};

    document.addEventListener('DOMContentLoaded', function () {
        const loginTab = document.getElementById('loginTab');
        const signupTab = document.getElementById('signupTab');
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        const footerText = document.getElementById('footerText');

        function bindFooter() {
            const fb = document.getElementById('footerButton');
            if (!fb) return;
            fb.addEventListener('click', function () {
                if (signupForm && !signupForm.classList.contains('hidden')) {
                    showLogin();
                } else {
                    showSignup();
                }
            });
        }

        function showLogin() {
            if (loginTab) loginTab.classList.add('active');
            if (signupTab) signupTab.classList.remove('active');
            if (loginForm) loginForm.classList.remove('hidden');
            if (signupForm) signupForm.classList.add('hidden');
            if (footerText) {
                footerText.innerHTML =
                    'Нет аккаунта? <button type="button" id="footerButton">Зарегистрируйтесь</button>';
                bindFooter();
            }
            if (typeof window.resetSignupWizard === 'function') {
                window.resetSignupWizard();
            }
        }

        function showSignup() {
            if (signupTab) signupTab.classList.add('active');
            if (loginTab) loginTab.classList.remove('active');
            if (signupForm) signupForm.classList.remove('hidden');
            if (loginForm) loginForm.classList.add('hidden');
            if (footerText) {
                footerText.innerHTML =
                    'Уже есть аккаунт? <button type="button" id="footerButton">Войти</button>';
                bindFooter();
            }
            if (typeof window.resetSignupWizard === 'function') {
                window.resetSignupWizard();
            }
        }

        if (loginTab) loginTab.addEventListener('click', showLogin);
        if (signupTab) signupTab.addEventListener('click', showSignup);
        bindFooter();

        function resolveAuthRedirectUrl(pathOrUrl) {
            if (!pathOrUrl) {
                return window.location.origin + '/profile/';
            }
            if (/^https?:\/\//i.test(pathOrUrl)) {
                return pathOrUrl;
            }
            return window.location.origin + (pathOrUrl.charAt(0) === '/' ? pathOrUrl : '/' + pathOrUrl);
        }

        function absUrlOnId(url) {
            var u = String(url || '');
            if (!u) {
                return '';
            }
            if (/^https?:\/\//i.test(u)) {
                return u;
            }
            return window.location.origin + (u.charAt(0) === '/' ? u : '/' + u);
        }

        function applyLoggedInBootstrap(bj) {
  bj = aidApplyBeamResumeUi(bj);
            const panel = document.getElementById('sessionResumePanel');
            const guest = document.getElementById('authGuestBlock');
            const footerWrap = document.getElementById('footerTextWrap');
            const finishForm = document.getElementById('oauthFinishForm');
            const continueBtn = document.getElementById('oauthContinueBtn');
            const finishRedirect = document.getElementById('oauthFinishRedirectUri');
            const finishClient = document.getElementById('oauthFinishClientId');
            const finishState = document.getElementById('oauthFinishState');
            const oauthReady = !!(bj.oauth_finish && bj.oauth_finish.redirect_uri);
            const hint = document.getElementById('sessionResumeHint');
            const nameEl = document.getElementById('sessionResumeName');
            const emailEl = document.getElementById('sessionResumeEmail');
            const img = document.getElementById('sessionResumeAvatarImg');
            const fb = document.getElementById('sessionResumeAvatarFallback');
            if (!panel || !guest) {
                return;
            }
            if (!bj.logged_in || !bj.user) {
                panel.classList.remove('visible');
                guest.classList.remove('hidden');
                if (footerWrap) {
                    footerWrap.classList.remove('hidden');
                }
                return;
            }
            const u = bj.user;
            if (nameEl) {
                nameEl.textContent = (u.display_name || '').trim() || ((u.email || '').split('@')[0] || 'Аккаунт');
            }
            if (emailEl) {
                emailEl.textContent = u.email || '';
            }
            const initial = ((u.display_name || u.email || '?').trim().charAt(0) || '?').toUpperCase();
            if (fb) {
                fb.textContent = initial;
                fb.classList.remove('hidden');
            }
            if (img) {
                const raw = (u.avatar_url || '').trim();
                if (raw) {
                    let src = raw;
                    if (!/^https?:\/\//i.test(src) && src.charAt(0) === '/') {
                        src = window.location.origin + src;
                    }
                    img.onload = function () {
                        img.classList.remove('hidden');
                        if (fb) {
                            fb.classList.add('hidden');
                        }
                    };
                    img.onerror = function () {
                        img.classList.add('hidden');
                        if (fb) {
                            fb.classList.remove('hidden');
                        }
                    };
                    img.src = src;
                } else {
                    img.classList.add('hidden');
                    img.removeAttribute('src');
                }
            }
            const site = bj.return_site || '';
            const prod = bj.oauth_product || {};
            const continueLabel = (prod.continue_label || '').trim();
            const productTitle = (prod.product_title || '').trim();
            if (finishForm && continueBtn && oauthReady) {
                const fin = bj.oauth_finish;
                finishForm.action = absUrlOnId(fin.action || '/api/oauth-finish.php');
                if (finishRedirect) {
                    finishRedirect.value = fin.redirect_uri || '';
                }
                if (finishClient) {
                    finishClient.value = fin.client_id || clientId;
                }
                if (finishState) {
                    finishState.value = fin.state || state;
                }
                finishForm.classList.remove('hidden');
                continueBtn.classList.remove('hidden');
                let label = continueLabel || 'Продолжить в приложение';
                if (!continueLabel && site) {
                    label = 'Продолжить на ' + site;
                    const path = bj.oauth_next_path || '';
                    if (path && path !== '/') {
                        label += ' — затем ' + path;
                    }
                }
                continueBtn.textContent = label;
                if (!finishForm.dataset.boundSubmit) {
                    finishForm.dataset.boundSubmit = '1';
                    finishForm.addEventListener('submit', function () {
                        continueBtn.disabled = true;
                        continueBtn.textContent = 'Подключаем…';
                    });
                }
            } else if (finishForm && continueBtn) {
                finishForm.classList.add('hidden');
                continueBtn.classList.add('hidden');
            }
            if (hint) {
                if (oauthReady) {
                    hint.classList.remove('hidden');
                    const who = productTitle || site || 'приложение';
                    const btn = continueLabel || 'Продолжить';
                    hint.textContent =
                        '«' +
                        who +
                        '» ждёт подтверждения входа под этим аккаунтом. Нажмите «' +
                        btn +
                        '» — вас вернёт в сервис.';
                } else {
                    hint.classList.add('hidden');
                    hint.textContent = '';
                }
            }
            
  if (aidIsBeamDesktopOAuth() && bj && bj.logged_in && bj.oauth_finish && bj.oauth_finish.redirect_uri) {
    var form = document.getElementById('oauthFinishForm');
    if (form && !form.dataset.beamAuto) {
      form.dataset.beamAuto = '1';
      setTimeout(function () {
        try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch (eAuto) {}
      }, 320);
    }
  }

  panel.classList.add('visible');
            guest.classList.add('hidden');
            if (footerWrap) {
                footerWrap.classList.add('hidden');
            }
        }

        const switchSessBtn = document.getElementById('sessionResumeSwitchBtn');
        if (switchSessBtn) {
            switchSessBtn.addEventListener('click', function () {
                try {
                    Object.keys(sessionStorage).forEach(function (k) {
                        if (k.indexOf('aid_oauth_autoredirect_v1_') === 0) {
                            sessionStorage.removeItem(k);
                        }
                    });
                } catch (eClr) {}
                const next = '/auth/' + (location.search || '');
                window.location.href = '/api/logout.php?next=' + encodeURIComponent(next);
            });
        }

        const loginEmailInput = document.getElementById('loginEmail');
        const loginPasswordInput = document.getElementById('loginPassword');

        if (loginForm && loginEmailInput) {
            loginForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                if (!validateEmail(loginEmailInput.value)) {
                    loginEmailInput.classList.add('error');
                    document.getElementById('loginEmailError').classList.add('show');
                    return;
                }
                loginEmailInput.classList.remove('error');
                document.getElementById('loginEmailError').classList.remove('show');
                if (loginPasswordInput) {
                    if (!loginPasswordInput.value.trim()) {
                        loginPasswordInput.classList.add('error');
                        document.getElementById('loginPasswordError').classList.add('show');
                        return;
                    }
                    loginPasswordInput.classList.remove('error');
                    document.getElementById('loginPasswordError').classList.remove('show');
                }
                const submitBtn = document.getElementById('loginSubmitBtn');
                if (!submitBtn) return;
                const prevText = submitBtn.textContent;
                submitBtn.classList.add('loading');
                submitBtn.textContent = '';
                try {
                    const fd = new FormData();
                    fd.append('action', 'login_password');
                    fd.append('email', loginEmailInput.value.trim());
                    if (loginPasswordInput) fd.append('password', loginPasswordInput.value);
                    fd.append('redirect_uri', redirectUri);
                    fd.append('client_id', clientId);
                    fd.append('state', state);
                    const r = await fetch('/api/login-actions.php', { method: 'POST', body: fd, credentials: 'include' });
                    const j = await safeJson(r);
                    if (!j.ok) throw new Error(j.error || 'Ошибка входа');
                    window.location.assign(resolveAuthRedirectUrl(j.redirect));
                } catch (err) {
                    showToast(err.message || 'Ошибка сети', 'error');
                } finally {
                    submitBtn.classList.remove('loading');
                    submitBtn.textContent = prevText;
                }
            });
        }

        const regStep1 = document.getElementById('regStep1');
        const regStep2 = document.getElementById('regStep2');
        const regStep3 = document.getElementById('regStep3');
        const regStep4 = document.getElementById('regStep4');

        function setSignupStep(n) {
            [regStep1, regStep2, regStep3, regStep4].forEach(function (el, i) {
                if (!el) return;
                el.classList.toggle('hidden', i + 1 !== n);
            });
        }

        function resetSignupWizard() {
            const emailInput = document.getElementById('signupEmail');
            const otpInput = document.getElementById('signupOtpCode');
            const p1 = document.getElementById('signupPassword');
            const p2 = document.getElementById('signupPasswordConfirm');
            const nm = document.getElementById('regDisplayName');
            if (emailInput) emailInput.value = '';
            if (otpInput) otpInput.value = '';
            if (p1) p1.value = '';
            if (p2) p2.value = '';
            if (nm) nm.value = '';
            setSignupStep(1);
        }

        window.resetSignupWizard = resetSignupWizard;

        function postLoginAction(fd) {
            fd.append('redirect_uri', redirectUri);
            fd.append('client_id', clientId);
            fd.append('state', state);
            return fetch('/api/login-actions.php', { method: 'POST', body: fd, credentials: 'include' });
        }

        const regSendCodeBtn = document.getElementById('regSendCodeBtn');
        if (regSendCodeBtn) {
            regSendCodeBtn.addEventListener('click', async function () {
                const emailInput = document.getElementById('signupEmail');
                if (!emailInput) return;
                if (!validateEmail(emailInput.value)) {
                    emailInput.classList.add('error');
                    const er = document.getElementById('signupEmailError');
                    if (er) er.classList.add('show');
                    return;
                }
                emailInput.classList.remove('error');
                const er = document.getElementById('signupEmailError');
                if (er) er.classList.remove('show');
                const prev = regSendCodeBtn.textContent;
                regSendCodeBtn.classList.add('loading');
                regSendCodeBtn.textContent = '';
                try {
                    const fd = new FormData();
                    fd.append('action', 'send_register_code');
                    fd.append('email', emailInput.value.trim());
                    const r = await postLoginAction(fd);
                    const j = await safeJson(r);
                    if (!j.ok) throw new Error(j.error || 'Ошибка');
                    if (j.dev_code) alert('DEV: код регистрации ' + j.dev_code);
                    else showToast(j.message || 'Код отправлен', 'success');
                    const disp = document.getElementById('regEmailDisplay');
                    if (disp) disp.textContent = emailInput.value.trim();
                    setSignupStep(2);
                } catch (err) {
                    showToast(err.message || 'Ошибка сети', 'error');
                } finally {
                    regSendCodeBtn.classList.remove('loading');
                    regSendCodeBtn.textContent = prev;
                }
            });
        }

        const regVerifyCodeBtn = document.getElementById('regVerifyCodeBtn');
        if (regVerifyCodeBtn) {
            regVerifyCodeBtn.addEventListener('click', async function () {
                const emailInput = document.getElementById('signupEmail');
                const otpInput = document.getElementById('signupOtpCode');
                if (!emailInput || !otpInput) return;
                const code = otpInput.value.replace(/\D/g, '');
                if (code.length < 4) {
                    otpInput.classList.add('error');
                    const er = document.getElementById('signupOtpError');
                    if (er) er.classList.add('show');
                    return;
                }
                otpInput.classList.remove('error');
                const er = document.getElementById('signupOtpError');
                if (er) er.classList.remove('show');
                const prev = regVerifyCodeBtn.textContent;
                regVerifyCodeBtn.classList.add('loading');
                regVerifyCodeBtn.textContent = '';
                try {
                    const fd = new FormData();
                    fd.append('action', 'verify_register_code');
                    fd.append('email', emailInput.value.trim());
                    fd.append('code', code);
                    const r = await postLoginAction(fd);
                    const j = await safeJson(r);
                    if (!j.ok) throw new Error(j.error || 'Ошибка');
                    showToast('Email подтверждён', 'success');
                    setSignupStep(3);
                } catch (err2) {
                    showToast(err2.message || 'Ошибка сети', 'error');
                } finally {
                    regVerifyCodeBtn.classList.remove('loading');
                    regVerifyCodeBtn.textContent = prev;
                }
            });
        }

        const regBackToEmailBtn = document.getElementById('regBackToEmailBtn');
        if (regBackToEmailBtn) {
            regBackToEmailBtn.addEventListener('click', function () {
                setSignupStep(1);
            });
        }

        const regResendCodeBtn = document.getElementById('regResendCodeBtn');
        if (regResendCodeBtn) {
            regResendCodeBtn.addEventListener('click', async function () {
                const emailInput = document.getElementById('signupEmail');
                if (!emailInput || !validateEmail(emailInput.value)) {
                    showToast('Сначала укажите корректный email на шаге 1', 'error');
                    return;
                }
                try {
                    const fd = new FormData();
                    fd.append('action', 'send_register_code');
                    fd.append('email', emailInput.value.trim());
                    const r = await postLoginAction(fd);
                    const j = await safeJson(r);
                    if (!j.ok) throw new Error(j.error || 'Ошибка');
                    if (j.dev_code) alert('DEV: код регистрации ' + j.dev_code);
                    else showToast(j.message || 'Код отправлен повторно', 'success');
                } catch (err3) {
                    showToast(err3.message || 'Ошибка сети', 'error');
                }
            });
        }

        const regPasswordNextBtn = document.getElementById('regPasswordNextBtn');
        if (regPasswordNextBtn) {
            regPasswordNextBtn.addEventListener('click', async function () {
                const passwordInput = document.getElementById('signupPassword');
                const passwordConfirmInput = document.getElementById('signupPasswordConfirm');
                if (!passwordInput || !passwordConfirmInput) return;
                let ok = true;
                if (passwordInput.value.length < 8) {
                    passwordInput.classList.add('error');
                    const el = document.getElementById('signupPasswordError');
                    if (el) el.classList.add('show');
                    ok = false;
                } else {
                    passwordInput.classList.remove('error');
                    const el = document.getElementById('signupPasswordError');
                    if (el) el.classList.remove('show');
                }
                if (!passwordConfirmInput.value || passwordInput.value !== passwordConfirmInput.value) {
                    passwordConfirmInput.classList.add('error');
                    const el = document.getElementById('signupPasswordConfirmError');
                    if (el) el.classList.add('show');
                    ok = false;
                } else {
                    passwordConfirmInput.classList.remove('error');
                    const el = document.getElementById('signupPasswordConfirmError');
                    if (el) el.classList.remove('show');
                }
                if (!ok) return;
                const prev = regPasswordNextBtn.textContent;
                regPasswordNextBtn.classList.add('loading');
                regPasswordNextBtn.textContent = '';
                try {
                    const fd = new FormData();
                    fd.append('action', 'set_register_password');
                    fd.append('password', passwordInput.value);
                    fd.append('password_confirm', passwordConfirmInput.value);
                    const r = await postLoginAction(fd);
                    const j = await safeJson(r);
                    if (!j.ok) throw new Error(j.error || 'Ошибка');
                    setSignupStep(4);
                } catch (err4) {
                    showToast(err4.message || 'Ошибка сети', 'error');
                } finally {
                    regPasswordNextBtn.classList.remove('loading');
                    regPasswordNextBtn.textContent = prev;
                }
            });
        }

        const regFinalSubmitBtn = document.getElementById('regFinalSubmitBtn');
        if (regFinalSubmitBtn) {
            regFinalSubmitBtn.addEventListener('click', async function () {
                const nameInput = document.getElementById('regDisplayName');
                if (!nameInput || !nameInput.value.trim()) {
                    nameInput.classList.add('error');
                    const el = document.getElementById('regDisplayNameError');
                    if (el) el.classList.add('show');
                    return;
                }
                nameInput.classList.remove('error');
                const el = document.getElementById('regDisplayNameError');
                if (el) el.classList.remove('show');
                const prev = regFinalSubmitBtn.textContent;
                regFinalSubmitBtn.classList.add('loading');
                regFinalSubmitBtn.textContent = '';
                try {
                    const fd = new FormData();
                    fd.append('action', 'complete_register_profile');
                    fd.append('display_name', nameInput.value.trim());
                    const r = await postLoginAction(fd);
                    const j = await safeJson(r);
                    if (!j.ok) throw new Error(j.error || 'Ошибка регистрации');
                    window.location.assign(resolveAuthRedirectUrl(j.redirect));
                } catch (e3) {
                    showToast(e3.message || 'Ошибка сети', 'error');
                } finally {
                    regFinalSubmitBtn.classList.remove('loading');
                    regFinalSubmitBtn.textContent = prev;
                }
            });
        }

        if (signupForm) {
            signupForm.addEventListener('submit', function (e) {
                e.preventDefault();
            });
        }

        const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
        const forgotPasswordModal = document.getElementById('forgotPasswordModal');
        const forgotPasswordForm = document.getElementById('forgotPasswordForm');
        const resetStep1 = document.getElementById('resetStep1');
        const resetStep2 = document.getElementById('resetStep2');

        function resetForgotModalUi() {
            if (resetStep1) resetStep1.classList.remove('hidden');
            if (resetStep2) resetStep2.classList.add('hidden');
            const c = document.getElementById('resetCode');
            const p1 = document.getElementById('resetNewPassword');
            const p2 = document.getElementById('resetNewPassword2');
            if (c) c.value = '';
            if (p1) p1.value = '';
            if (p2) p2.value = '';
        }

        if (forgotPasswordBtn && forgotPasswordModal) {
            forgotPasswordBtn.addEventListener('click', function () {
                resetForgotModalUi();
                const re = document.getElementById('resetEmail');
                if (re && loginEmailInput && validateEmail(loginEmailInput.value)) {
                    re.value = loginEmailInput.value.trim();
                }
                forgotPasswordModal.classList.add('show');
            });
        }
        window.closeForgotPasswordModal = function () {
            if (forgotPasswordModal) forgotPasswordModal.classList.remove('show');
            resetForgotModalUi();
        };
        if (forgotPasswordModal) {
            forgotPasswordModal.addEventListener('click', function (e) {
                if (e.target === forgotPasswordModal) {
                    window.closeForgotPasswordModal();
                }
            });
        }
        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                const resetEmail = document.getElementById('resetEmail');
                if (!resetEmail || !validateEmail(resetEmail.value)) {
                    if (resetEmail) resetEmail.classList.add('error');
                    const el = document.getElementById('resetEmailError');
                    if (el) el.classList.add('show');
                    return;
                }
                resetEmail.classList.remove('error');
                const errEl = document.getElementById('resetEmailError');
                if (errEl) errEl.classList.remove('show');
                const btn = document.getElementById('resetSubmitBtn');
                const prevB = btn ? btn.textContent : '';
                if (btn) {
                    btn.classList.add('loading');
                    btn.textContent = '';
                }
                try {
                    const fd = new FormData();
                    fd.append('action', 'send_password_reset');
                    fd.append('email', resetEmail.value.trim());
                    const r = await fetch('/api/login-actions.php', { method: 'POST', body: fd, credentials: 'include' });
                    const j = await safeJson(r);
                    if (!j.ok) throw new Error(j.error || 'Ошибка');
                    if (j.dev_code) alert('DEV: код сброса ' + j.dev_code);
                    else showToast(j.message || 'Готово', 'success');
                    const disp = document.getElementById('resetEmailDisplay');
                    if (disp) disp.textContent = resetEmail.value.trim();
                    if (resetStep1) resetStep1.classList.add('hidden');
                    if (resetStep2) resetStep2.classList.remove('hidden');
                } catch (err2) {
                    showToast(err2.message || 'Ошибка сети', 'error');
                } finally {
                    if (btn) {
                        btn.classList.remove('loading');
                        btn.textContent = prevB;
                    }
                }
            });
        }

        const resetBackBtn = document.getElementById('resetBackBtn');
        if (resetBackBtn) {
            resetBackBtn.addEventListener('click', function () {
                resetForgotModalUi();
            });
        }

        const resetCompleteBtn = document.getElementById('resetCompleteBtn');
        if (resetCompleteBtn) {
            resetCompleteBtn.addEventListener('click', async function () {
                const resetEmail = document.getElementById('resetEmail');
                const codeEl = document.getElementById('resetCode');
                const p1 = document.getElementById('resetNewPassword');
                const p2 = document.getElementById('resetNewPassword2');
                if (!resetEmail || !codeEl || !p1 || !p2) return;
                if (!codeEl.value.trim()) {
                    codeEl.classList.add('error');
                    document.getElementById('resetCodeError').classList.add('show');
                    return;
                }
                codeEl.classList.remove('error');
                document.getElementById('resetCodeError').classList.remove('show');
                if (p1.value.length < 8) {
                    p1.classList.add('error');
                    document.getElementById('resetNewPasswordError').classList.add('show');
                    return;
                }
                p1.classList.remove('error');
                document.getElementById('resetNewPasswordError').classList.remove('show');
                if (p1.value !== p2.value) {
                    p2.classList.add('error');
                    document.getElementById('resetNewPassword2Error').classList.add('show');
                    return;
                }
                p2.classList.remove('error');
                document.getElementById('resetNewPassword2Error').classList.remove('show');
                const prevC = resetCompleteBtn.textContent;
                resetCompleteBtn.classList.add('loading');
                resetCompleteBtn.textContent = '';
                try {
                    const fd = new FormData();
                    fd.append('action', 'complete_password_reset');
                    fd.append('email', resetEmail.value.trim());
                    fd.append('code', codeEl.value.trim());
                    fd.append('password', p1.value);
                    fd.append('password_confirm', p2.value);
                    fd.append('redirect_uri', redirectUri);
                    fd.append('client_id', clientId);
                    fd.append('state', state);
                    const r = await fetch('/api/login-actions.php', { method: 'POST', body: fd, credentials: 'include' });
                    const j = await safeJson(r);
                    if (!j.ok) throw new Error(j.error || 'Ошибка');
                    window.location.assign(resolveAuthRedirectUrl(j.redirect));
                } catch (err3) {
                    showToast(err3.message || 'Ошибка сети', 'error');
                } finally {
                    resetCompleteBtn.classList.remove('loading');
                    resetCompleteBtn.textContent = prevC;
                }
            });
        }

        ['loginEmail', 'signupEmail', 'resetEmail'].forEach(function (id) {
            const input = document.getElementById(id);
            if (!input) return;
            input.addEventListener('blur', function () {
                const errEl = document.getElementById(id + 'Error');
                if (!errEl) return;
                if (this.value.length > 0 && !validateEmail(this.value)) {
                    this.classList.add('error');
                    this.classList.remove('success');
                    errEl.classList.add('show');
                } else if (this.value.length > 0) {
                    this.classList.remove('error');
                    this.classList.add('success');
                    errEl.classList.remove('show');
                }
            });
        });
        if (loginPasswordInput) {
            loginPasswordInput.addEventListener('blur', function () {
                const errEl = document.getElementById('loginPasswordError');
                if (!errEl) return;
                if (this.value.length > 0) {
                    this.classList.remove('error');
                    errEl.classList.remove('show');
                }
            });
        }

        (async function init() {
            try {
                const bq = new URLSearchParams(location.search);
                const br = await fetch('/api/bootstrap-login.php?' + bq.toString(), {
                    credentials: 'include',
                });
                const bj = await safeJson(br);
                applyLoggedInBootstrap(bj);
                if (bj.oauth_error) {
                    showToast(String(bj.oauth_error), 'error');
                }
            } catch (eInit) {
                showToast(eInit.message || 'Не удалось загрузить страницу входа', 'error');
            }
            const oq = oauthQuery();
            try {
                const os = await fetch('/api/oauth-status.php', { credentials: 'include' }).then(function (r) {
                    return r.json();
                });
                document.querySelectorAll('#oauthBox a[data-p]').forEach(function (a) {
                    const p = a.getAttribute('data-p');
                    if (os[p]) {
                        a.classList.remove('oauth-disabled');
                        a.removeAttribute('aria-disabled');
                        a.href = '/api/oauth/' + p + '/start.php?' + oq;
                    }
                });
            } catch (e4) {
                /* ignore */
            }
        })();
    });
})();
