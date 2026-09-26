#!/usr/bin/env node
/* 小团·陪伴 — 零依赖自托管服务器
 * 同时托管：游戏 App（/）、管理后台（/admin）、REST API（/api）
 * 纯 Node 内置模块，无需 npm install。运行：node server.js
 *
 * 数据存储：data/store.json（自动创建，零配置）
 * 管理员：第一个注册的用户自动成为管理员；或设置环境变量 ADMIN_EMAIL 指定
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const STORE = path.join(DATA_DIR, 'store.json');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase();

/* ---------------- 存储 ---------------- */
function freshStore() {
  return {
    users: [], pets: [], events: [], transactions: [], tickets: [],
    announcements: [],
    config: {
      growth_multiplier: { base: 1, companion: 2, game: 2.5, vip_bonus: 0.3 },
      compensation_enabled: true,
    },
    tokens: {}, // token -> userId
  };
}
let store = freshStore();
function loadStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(STORE)) {
    try { store = JSON.parse(fs.readFileSync(STORE, 'utf8')); }
    catch (e) { console.error('store.json 损坏，已重置'); store = freshStore(); }
  } else {
    store = freshStore();
    saveStore();
  }
  // 补全可能缺失的字段
  for (const k of ['users', 'pets', 'events', 'transactions', 'tickets', 'announcements', 'tokens']) {
    if (!store[k]) store[k] = [];
  }
  if (!store.config) store.config = freshStore().config;
}
function saveStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STORE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE);
}

/* ---------------- 工具 ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { resolve({}); } });
  });
}
function genUid() {
  let u;
  do { u = crypto.randomBytes(3).toString('hex').toUpperCase(); }
  while (store.users.some((x) => x.uid === u));
  return u;
}
function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString('hex'); }
function newToken() { return crypto.randomBytes(24).toString('hex'); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function authUser(req, body) {
  const h = req.headers['authorization'] || '';
  const tk = h.startsWith('Bearer ') ? h.slice(7) : (body && body.token);
  if (!tk) return null;
  const uid = store.tokens[tk];
  if (!uid) return null;
  const u = store.users.find((x) => x.id === uid);
  if (!u || u.banned) return null;
  return u;
}
function requireAdmin(req, body) {
  const u = authUser(req, body);
  if (!u) return null;
  if (!u.isAdmin) return 'forbidden';
  return u;
}

/* ---------------- API 路由 ---------------- */
async function handleApi(req, res, pathname) {
  const method = req.method;
  const body = (method === 'POST' || method === 'PUT' || method === 'DELETE') ? await readBody(req) : {};

  // 健康检查（无需鉴权）
  if (pathname === '/api/health') return sendJson(res, 200, { ok: true });

  // 公开：注册 / 登录 / 退出
  if (pathname === '/api/register' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const nickname = String(body.nickname || '').trim() || '玩家';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return sendJson(res, 400, { error: '邮箱格式不正确' });
    if (password.length < 6) return sendJson(res, 400, { error: '密码至少 6 位' });
    if (store.users.some((u) => u.email === email)) return sendJson(res, 400, { error: '该邮箱已注册，请直接登录' });
    const isFirst = store.users.length === 0;
    const isAdmin = isFirst || (ADMIN_EMAIL && email === ADMIN_EMAIL);
    const salt = crypto.randomBytes(16).toString('hex');
    const user = {
      id: crypto.randomUUID(), uid: genUid(), email, nickname,
      pwHash: hashPw(password, salt), pwSalt: salt,
      isAdmin, banned: false, createdAt: new Date().toISOString(),
    };
    store.users.push(user);
    store.pets.push({ userId: user.id, name: '小团', color: '#FFB37A', state: {}, createdAt: new Date().toISOString() });
    const token = newToken();
    store.tokens[token] = user.id;
    saveStore();
    return sendJson(res, 200, {
      token,
      user: { id: user.id, uid: user.uid, nickname: user.nickname, isAdmin: user.isAdmin },
    });
  }

  if (pathname === '/api/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = store.users.find((u) => u.email === email);
    if (!user || hashPw(password, user.pwSalt) !== user.pwHash) return sendJson(res, 401, { error: '邮箱或密码错误' });
    if (user.banned) return sendJson(res, 403, { error: '账号已被封禁' });
    if (ADMIN_EMAIL && email === ADMIN_EMAIL && !user.isAdmin) { user.isAdmin = true; saveStore(); }
    const token = newToken();
    store.tokens[token] = user.id;
    saveStore();
    return sendJson(res, 200, {
      token,
      user: { id: user.id, uid: user.uid, nickname: user.nickname, isAdmin: user.isAdmin },
    });
  }

  if (pathname === '/api/logout' && method === 'POST') {
    const h = req.headers['authorization'] || '';
    const tk = h.startsWith('Bearer ') ? h.slice(7) : (body.token);
    if (tk && store.tokens[tk]) { delete store.tokens[tk]; saveStore(); }
    return sendJson(res, 200, { ok: true });
  }

  // 以下均需登录
  const me = authUser(req, body);
  if (!me) return sendJson(res, 401, { error: '未登录或登录已失效' });

  if (pathname === '/api/me' && method === 'GET') {
    const pet = store.pets.find((p) => p.userId === me.id);
    return sendJson(res, 200, {
      user: { id: me.id, uid: me.uid, nickname: me.nickname, isAdmin: me.isAdmin },
      pet: pet ? { name: pet.name, color: pet.color } : null,
    });
  }

  if (pathname === '/api/state' && method === 'GET') {
    let pet = store.pets.find((p) => p.userId === me.id);
    if (!pet) { pet = { userId: me.id, name: '小团', color: '#FFB37A', state: {}, createdAt: new Date().toISOString() }; store.pets.push(pet); saveStore(); }
    return sendJson(res, 200, { has: true, state: pet.state || {}, name: pet.name, color: pet.color });
  }

  if (pathname === '/api/state' && method === 'PUT') {
    let pet = store.pets.find((p) => p.userId === me.id);
    if (!pet) { pet = { userId: me.id, name: '小团', color: '#FFB37A', state: {}, createdAt: new Date().toISOString() }; store.pets.push(pet); }
    pet.state = body.state || {};
    if (body.name) pet.name = String(body.name).slice(0, 20);
    if (body.color) pet.color = String(body.color).slice(0, 9);
    saveStore();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/event' && method === 'POST') {
    store.events.push({
      ts: new Date().toISOString(), userId: me.id,
      type: String(body.type || 'event'),
      mins: Number(body.mins || 0), coins: Number(body.coins || 0),
    });
    // 控制体积：仅保留最近 5000 条
    if (store.events.length > 5000) store.events = store.events.slice(-5000);
    saveStore();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/ticket' && method === 'POST') {
    store.tickets.push({
      id: crypto.randomUUID(), userId: me.id,
      type: String(body.type || 'feedback'),
      content: String(body.content || '').slice(0, 1000),
      status: 'open', reply: null, handler: null, createdAt: new Date().toISOString(),
    });
    saveStore();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/announcements' && method === 'GET') {
    const list = store.announcements.filter((a) => a.active).map((a) => ({ id: a.id, title: a.title, body: a.body }));
    return sendJson(res, 200, { list });
  }

  /* ---------- 管理后台接口（需 isAdmin） ---------- */
  if (pathname.startsWith('/api/admin/')) {
    const admin = requireAdmin(req, body);
    if (admin === null) return sendJson(res, 401, { error: '未登录或登录已失效' });
    if (admin === 'forbidden') return sendJson(res, 403, { error: '无后台管理权限' });

    if (pathname === '/api/admin/stats' && method === 'GET') {
      const today = todayStr();
      const activeSet = new Set(store.events.filter((e) => e.ts.slice(0, 10) === today).map((e) => e.userId));
      const vip = store.pets.filter((p) => p.state && p.state.vipUntil && p.state.vipUntil > Date.now()).length;
      const recharge = store.transactions.filter((t) => t.type === 'coin_recharge').reduce((s, t) => s + (t.amount || 0), 0);
      const dist = {};
      store.pets.forEach((p) => { const k = (p.state && p.state.stage) || '未知'; dist[k] = (dist[k] || 0) + 1; });
      return sendJson(res, 200, {
        users: store.users.length, activeToday: activeSet.size, vip, rechargeTotal: recharge, stageDist: dist,
      });
    }

    if (pathname === '/api/admin/users' && method === 'GET') {
      const q = String((req.url.split('?')[1] ? new URLSearchParams(req.url.split('?')[1]).get('q') : '') || '').trim().toLowerCase();
      const list = store.users
        .filter((u) => !q || u.uid.toLowerCase().includes(q) || u.nickname.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 50)
        .map((u) => {
          const pet = store.pets.find((p) => p.userId === u.id);
          return {
            id: u.id, uid: u.uid, nickname: u.nickname, email: u.email,
            createdAt: u.createdAt, banned: u.banned,
            petName: pet ? pet.name : '-',
            stage: pet && pet.state ? (pet.state.stage || '-') : '-',
          };
        });
      return sendJson(res, 200, { list, count: store.users.length });
    }

    let m;
    if ((m = pathname.match(/^\/api\/admin\/user\/([^/]+)$/)) && method === 'GET') {
      const u = store.users.find((x) => x.id === m[1]);
      if (!u) return sendJson(res, 404, { error: '用户不存在' });
      const pet = store.pets.find((p) => p.userId === u.id);
      return sendJson(res, 200, {
        user: { id: u.id, uid: u.uid, nickname: u.nickname, email: u.email, createdAt: u.createdAt, banned: u.banned, isAdmin: u.isAdmin },
        pet: pet ? { name: pet.name, color: pet.color, state: pet.state || {}, createdAt: pet.createdAt } : null,
      });
    }

    if ((m = pathname.match(/^\/api\/admin\/user\/([^/]+)\/ban$/)) && method === 'POST') {
      const u = store.users.find((x) => x.id === m[1]);
      if (!u) return sendJson(res, 404, { error: '用户不存在' });
      u.banned = !!body.banned;
      // 封禁时吊销其所有会话
      if (u.banned) { for (const [tk, uid] of Object.entries(store.tokens)) if (uid === u.id) delete store.tokens[tk]; }
      saveStore();
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/transactions' && method === 'GET') {
      const tx = store.transactions.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 100)
        .map((t) => ({ createdAt: t.createdAt, uid: t.uid, type: t.type, amount: t.amount, balanceAfter: t.balanceAfter }));
      return sendJson(res, 200, { list: tx });
    }

    if (pathname === '/api/admin/compensate' && method === 'POST') {
      if (!store.config.compensation_enabled) return sendJson(res, 403, { error: '补偿功能已关闭' });
      const uid = String(body.uid || '').trim().toUpperCase();
      const amount = parseInt(body.amount, 10);
      const note = String(body.note || '').slice(0, 100);
      if (!uid || !amount) return sendJson(res, 400, { error: '请填写 UID 和数量' });
      const u = store.users.find((x) => x.uid === uid);
      if (!u) return sendJson(res, 404, { error: '用户不存在' });
      const pet = store.pets.find((p) => p.userId === u.id);
      if (!pet) return sendJson(res, 404, { error: '该用户暂无宠物' });
      const coins = (pet.state.coins || 0) + amount;
      pet.state.coins = coins;
      store.transactions.push({ id: crypto.randomUUID(), userId: u.id, uid: u.uid, type: 'compensate', amount, balanceAfter: coins, note, createdAt: new Date().toISOString() });
      saveStore();
      return sendJson(res, 200, { ok: true, coins });
    }

    if (pathname === '/api/admin/tickets' && method === 'GET') {
      const list = store.tickets.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 100)
        .map((t) => {
          const u = store.users.find((x) => x.id === t.userId);
          return { id: t.id, createdAt: t.createdAt, uid: u ? u.uid : '?', type: t.type, status: t.status, content: t.content, reply: t.reply };
        });
      return sendJson(res, 200, { list });
    }

    if ((m = pathname.match(/^\/api\/admin\/ticket\/([^/]+)$/)) && method === 'POST') {
      const t = store.tickets.find((x) => x.id === m[1]);
      if (!t) return sendJson(res, 404, { error: '工单不存在' });
      if (body.reply !== undefined) t.reply = String(body.reply || '').slice(0, 1000) || null;
      if (body.status) t.status = body.status;
      t.handler = admin.id;
      saveStore();
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/config' && method === 'GET') {
      return sendJson(res, 200, {
        growth_multiplier: store.config.growth_multiplier,
        compensation_enabled: store.config.compensation_enabled,
        announcements: store.announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, active: a.active, createdAt: a.createdAt })),
      });
    }

    if (pathname === '/api/admin/config' && method === 'PUT') {
      if (body.growth_multiplier) store.config.growth_multiplier = body.growth_multiplier;
      if (typeof body.compensation_enabled === 'boolean') store.config.compensation_enabled = body.compensation_enabled;
      saveStore();
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/announcement' && method === 'POST') {
      const title = String(body.title || '').trim();
      const bodyText = String(body.body || '').trim();
      if (!title) return sendJson(res, 400, { error: '请填写标题' });
      store.announcements.unshift({ id: crypto.randomUUID(), title, body: bodyText, active: true, createdAt: new Date().toISOString() });
      saveStore();
      return sendJson(res, 200, { ok: true });
    }

    if ((m = pathname.match(/^\/api\/admin\/announcement\/([^/]+)$/)) && method === 'PUT') {
      const a = store.announcements.find((x) => x.id === m[1]);
      if (!a) return sendJson(res, 404, { error: '公告不存在' });
      if (typeof body.active === 'boolean') a.active = body.active;
      saveStore();
      return sendJson(res, 200, { ok: true });
    }

    if ((m = pathname.match(/^\/api\/admin\/announcement\/([^/]+)$/)) && method === 'DELETE') {
      store.announcements = store.announcements.filter((x) => x.id !== m[1]);
      saveStore();
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: '接口不存在' });
  }

  return sendJson(res, 404, { error: '接口不存在' });
}

/* ---------------- 静态托管 ---------------- */
function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (p.startsWith('/api/')) return await handleApi(req, res, p);
    if (p === '/admin' || p === '/admin/') return serveStatic(res, '/admin/index.html');
    return serveStatic(res, p);
  } catch (e) {
    sendJson(res, 500, { error: '服务器内部错误' });
  }
});

loadStore();
server.listen(PORT, HOST, () => {
  console.log(`小团·陪伴 已启动：http://localhost:${PORT}`);
  console.log(`管理后台：http://localhost:${PORT}/admin`);
  console.log(`数据存储：${STORE}`);
  if (store.users.length === 0) console.log('提示：第一个注册的用户将自动成为管理员。');
});
