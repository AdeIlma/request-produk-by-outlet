/* =========================================================
   OUTLET 23 — AUTH DASHBOARD FORECASTING (dashboard.html)
   Login diverifikasi di Google Apps Script. Browser hanya
   menyimpan token sesi (bukan password) di sessionStorage.
   ========================================================= */
const AdminAuth = (function () {
    'use strict';

    const SESSION_KEY = 'o23_forecast_session_v1';
    const TIMEOUT_MS = 30000;

    function isConfigured() {
        const url = (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_APPS_SCRIPT_URL) || '';
        return /^https:\/\//i.test(url) && url.indexOf('YOUR_') === -1;
    }

    async function call(payload) {
        if (!isConfigured()) throw new Error('URL Google Apps Script belum diisi di config.js.');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const res = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload),
                redirect: 'follow',
                signal: controller.signal
            });
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    function get() {
        try {
            const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
            if (s && s.token && s.user && Date.now() < s.expires) return s;
        } catch (e) { /* abaikan */ }
        return null;
    }

    function set(token, user, expiresIn) {
        const ttl = Math.max(60, Number(expiresIn) || 21600) * 1000;
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: token, user: user, expires: Date.now() + ttl - 60000 }));
        } catch (e) { /* abaikan */ }
    }

    function clear() {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* abaikan */ }
    }

    async function login(username, password) {
        const json = await call({ action: 'login', username: username, password: password });
        if (json && json.success && json.token) set(json.token, json.user, json.expiresIn);
        return json;
    }

    async function logout() {
        const s = get();
        clear();
        if (s) {
            try { await call({ action: 'logout', token: s.token }); } catch (e) { /* abaikan */ }
        }
    }

    async function list() {
        const s = get();
        if (!s) return { success: false, code: 'UNAUTHORIZED' };
        const json = await call({ action: 'list', token: s.token });
        if (json && json.code === 'UNAUTHORIZED') clear();
        return json;
    }

    return { isConfigured: isConfigured, get: get, clear: clear, login: login, logout: logout, list: list };
})();
