/* 小团·陪伴 云端层 — 对接本地 server.js 的 /api 接口（零依赖、同源 fetch）
 * 未配置或登录前：App 仍可纯本地游玩（localStorage 降级，由 app.js 控制）
 * 接口契约需与 app.js 保持一致：init/signUp/signIn/signOut/checkBanned/
 *   ensurePet/pullState/pushState/logEvent + ready/loggedIn/user/petName/petColor
 */
const Cloud = (() => {
  const TOKEN_KEY = 'xt_token';
  let token = (typeof localStorage !== 'undefined') ? (localStorage.getItem(TOKEN_KEY) || null) : null;
  let user = null;
  let ready = false;
  let petName = '小团';
  let petColor = '#FFB37A';

  async function api(method, path, body, useAuth) {
    const headers = { 'Content-Type': 'application/json' };
    if (useAuth && token) headers['Authorization'] = 'Bearer ' + token;
    try {
      const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      let data = null;
      try { data = await res.json(); } catch (e) { /* ignore */ }
      return { res, data };
    } catch (e) {
      return { res: { ok: false, status: 0 }, data: null, error: e };
    }
  }

  async function init() {
    // 探测后端是否可达；file:// 或无服务器时降级本地
    const probe = await api('GET', '/api/health', null, false);
    if (!probe.res.ok) { ready = false; return; }
    ready = true;
    if (token) {
      const { res, data } = await api('GET', '/api/me', null, true);
      if (res.ok && data && data.user) {
        user = data.user;
        if (data.pet) { petName = data.pet.name || petName; petColor = data.pet.color || petColor; }
      } else {
        token = null;
        try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
      }
    }
  }

  async function signUp(email, pwd, nick) {
    const { res, data } = await api('POST', '/api/register', { email, password: pwd, nickname: nick }, false);
    if (!res.ok) return { error: { message: (data && data.error) || '注册失败' } };
    token = data.token; try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
    user = data.user;
    return { user };
  }

  async function signIn(email, pwd) {
    const { res, data } = await api('POST', '/api/login', { email, password: pwd }, false);
    if (!res.ok) return { error: { message: (data && data.error) || '登录失败' } };
    token = data.token; try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
    user = data.user;
    return { user };
  }

  async function signOut() {
    await api('POST', '/api/logout', {}, true);
    token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    user = null;
  }

  async function checkBanned() { return !!(user && user.banned); }

  async function ensurePet() {
    const { res } = await api('GET', '/api/state', null, true);
    if (res.ok) return; // 服务器保证宠物存在
    await api('PUT', '/api/state', { state: {} }, true);
  }

  async function pullState() {
    const { res, data } = await api('GET', '/api/state', null, true);
    if (!res.ok || !data) return null;
    if (data.name) petName = data.name;
    if (data.color) petColor = data.color;
    return data.state || null;
  }

  async function pushState(S) {
    if (!user) return;
    let state; try { state = JSON.parse(JSON.stringify(S)); } catch (e) { return; }
    const { res } = await api('PUT', '/api/state', {
      state,
      name: (S && S.name) || petName,
      color: (S && S.color) || petColor,
    }, true);
    if (!res.ok) console.warn('pushState 失败');
  }

  async function logEvent(evt, extra) {
    if (!user) return;
    await api('POST', '/api/event', {
      type: evt,
      mins: (extra && extra.mins) || 0,
      coins: (extra && extra.coins) || 0,
    }, true);
  }

  return {
    init, signUp, signIn, signOut, checkBanned, ensurePet, pullState, pushState, logEvent,
    get ready() { return ready; },
    get loggedIn() { return !!user; },
    get user() { return user; },
    get petName() { return petName; },
    get petColor() { return petColor; },
  };
})();
