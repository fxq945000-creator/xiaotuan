/* 小团·陪伴 管理后台 — 纯前端，对接本地 server.js 的 /api/admin 接口 */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TK = 'xt_admin_token';
let token = localStorage.getItem(TK) || null;
let me = null;

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch (e) {}
  return { res, data };
}
function showErr(m) { const e = $('login-err'); if (e) e.textContent = m; }

async function boot() {
  $('login-btn').onclick = doLogin;
  $('logout-btn').onclick = doLogout;
  document.querySelectorAll('nav button[data-tab]').forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));
  if (token) {
    const { res, data } = await api('GET', '/api/me');
    if (res.ok && data.user && data.user.isAdmin) { me = data.user; enter(); return; }
    token = null; localStorage.removeItem(TK);
  }
}

async function doLogin() {
  showErr('');
  const email = $('email').value.trim(), pwd = $('pwd').value;
  if (!email || !pwd) { showErr('请输入邮箱和密码'); return; }
  const { res, data } = await api('POST', '/api/login', { email, password: pwd });
  if (!res.ok) { showErr((data && data.error) || '登录失败'); return; }
  if (!data.user.isAdmin) { showErr('该账号无后台管理权限（请使用管理员账号登录）'); return; }
  token = data.token; localStorage.setItem(TK, token); me = data.user; enter();
}
function enter() {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('me').textContent = me.nickname + '（' + me.uid + '）';
  switchTab('dash');
}
async function doLogout() { try { await api('POST', '/api/logout'); } catch (e) {} token = null; localStorage.removeItem(TK); location.reload(); }

function switchTab(tab) {
  document.querySelectorAll('nav button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'dash') renderDash();
  else if (tab === 'users') renderUsers();
  else if (tab === 'tx') renderTx();
  else if (tab === 'tickets') renderTickets();
  else if (tab === 'ops') renderOps();
}

/* ---------- 数据看板 ---------- */
async function renderDash() {
  $('content').innerHTML = '<p>加载中…</p>';
  const { res, data } = await api('GET', '/api/admin/stats');
  if (!res.ok) { $('content').innerHTML = '<p>错误：' + esc(data && data.error) + '</p>'; return; }
  const dist = data.stageDist || {};
  $('content').innerHTML =
    `<div class="grid">
       <div class="kpi"><b>${data.users || 0}</b><span>注册用户</span></div>
       <div class="kpi"><b>${data.activeToday || 0}</b><span>今日活跃</span></div>
       <div class="kpi"><b>${data.vip || 0}</b><span>有效会员</span></div>
       <div class="kpi"><b>${data.rechargeTotal || 0}</b><span>累计充值(星星币)</span></div>
     </div>
     <h3>宠物阶段分布</h3>
     <div class="grid">
       ${Object.entries(dist).map(([k, v]) => `<div class="kpi"><b>${v}</b><span>${esc(k)}</span></div>`).join('') || '<p>暂无数据</p>'}
     </div>`;
}

/* ---------- 用户与宠物 ---------- */
async function renderUsers(q) {
  $('content').innerHTML = '<p>加载中…</p>';
  const url = '/api/admin/users' + (q ? '?q=' + encodeURIComponent(q) : '');
  const { res, data } = await api('GET', url);
  if (!res.ok) { $('content').innerHTML = '<p>错误：' + esc(data && data.error) + '</p>'; return; }
  let html = `<div class="toolbar"><input id="uq" placeholder="搜索 UID / 昵称 / 邮箱"><button onclick="searchUsers()">搜索</button><span>${data.count || 0} 人</span></div>`;
  html += '<table class="tbl"><tr><th>UID</th><th>昵称</th><th>宠物</th><th>阶段</th><th>状态</th><th>注册</th><th>操作</th></tr>';
  (data.list || []).forEach((u) => {
    html += `<tr>
      <td>${esc(u.uid)}</td><td>${esc(u.nickname)}</td><td>${esc(u.petName)}</td>
      <td>${esc(u.stage)}</td>
      <td>${u.banned ? '<span class="bad">已封禁</span>' : '正常'}</td>
      <td>${esc((u.createdAt || '').slice(0, 10))}</td>
      <td>
        <button onclick="viewUser('${u.id}')">详情</button>
        ${u.banned ? `<button onclick="ban('${u.id}',false)">解封</button>` : `<button onclick="ban('${u.id}',true)">封禁</button>`}
      </td></tr>`;
  });
  html += '</table>';
  $('content').innerHTML = html;
}
function searchUsers() { renderUsers($('uq').value.trim()); }
async function viewUser(id) {
  const { res, data } = await api('GET', '/api/admin/user/' + id);
  if (!res.ok) { alert((data && data.error) || '查询失败'); return; }
  const u = data.user, pet = data.pet;
  const st = pet ? pet.state : {};
  const keys = ['health', 'hunger', 'mood', 'clean', 'energy', 'coins', 'stage', 'grade', 'school', 'bondMin'];
  const rows = keys.map((k) => `<tr><td>${k}</td><td>${esc(st[k])}</td></tr>`).join('');
  $('content').innerHTML = `<div class="card">
    <h3>${esc(u.nickname)}（${esc(u.uid)}）</h3>
    <p>邮箱：${esc(u.email)}　宠物名：${esc(pet ? pet.name : '-')}　注册：${esc((u.createdAt || '').slice(0, 10))}　封禁：${u.banned ? '是' : '否'}</p>
    <table class="tbl">${rows}</table>
    <button onclick="switchTab('users')">返回列表</button></div>`;
}
async function ban(id, banned) {
  if (banned && !confirm('确认封禁该用户？封禁后其账号将无法进入 App。')) return;
  const { res, data } = await api('POST', '/api/admin/user/' + id + '/ban', { banned });
  if (!res.ok) alert((data && data.error) || '操作失败'); else renderUsers();
}

/* ---------- 充值 / 会员 ---------- */
async function renderTx() {
  $('content').innerHTML = '<p>加载中…</p>';
  const { res, data } = await api('GET', '/api/admin/transactions');
  if (!res.ok) { $('content').innerHTML = '<p>错误：' + esc(data && data.error) + '</p>'; return; }
  let html = `<div class="card"><h3>补偿 / 补发星星币</h3>
    <input id="c-uid" placeholder="目标用户 UID">
    <input id="c-amt" type="number" placeholder="数量（正数=补发，负数=扣减）">
    <input id="c-note" placeholder="备注">
    <button onclick="doCompensate()">发放</button></div>`;
  html += '<h3>星星币流水（最近100）</h3><table class="tbl"><tr><th>时间</th><th>用户</th><th>类型</th><th>数量</th><th>余额</th></tr>';
  (data.list || []).forEach((r) => {
    html += `<tr><td>${esc((r.createdAt || '').slice(0, 19))}</td><td>${esc(r.uid)}</td><td>${esc(r.type)}</td><td>${r.amount}</td><td>${r.balanceAfter}</td></tr>`;
  });
  html += '</table>';
  $('content').innerHTML = html;
}
async function doCompensate() {
  const uid = $('c-uid').value.trim(), amt = parseInt($('c-amt').value, 10), note = $('c-note').value.trim();
  if (!uid || !amt) { alert('请填写 UID 和数量'); return; }
  const { res, data } = await api('POST', '/api/admin/compensate', { uid, amount: amt, note });
  if (!res.ok) { alert((data && data.error) || '发放失败'); return; }
  alert('已' + (amt >= 0 ? '补发' : '扣减') + ' ' + Math.abs(amt) + ' 星星币');
  renderTx();
}

/* ---------- 客服工单 ---------- */
async function renderTickets() {
  $('content').innerHTML = '<p>加载中…</p>';
  const { res, data } = await api('GET', '/api/admin/tickets');
  if (!res.ok) { $('content').innerHTML = '<p>错误：' + esc(data && data.error) + '</p>'; return; }
  let html = '<table class="tbl"><tr><th>时间</th><th>用户</th><th>类型</th><th>状态</th><th>内容</th><th>处理</th></tr>';
  (data.list || []).forEach((t) => {
    html += `<tr>
      <td>${esc((t.createdAt || '').slice(0, 19))}</td>
      <td>${esc(t.uid)}</td>
      <td>${esc(t.type)}</td><td>${esc(t.status)}</td>
      <td>${esc(t.content)}</td>
      <td><button onclick="replyTicket('${t.id}')">${t.status === 'open' ? '处理' : '查看'}</button></td>
    </tr>`;
  });
  html += '</table>';
  $('content').innerHTML = html;
}
async function replyTicket(id) {
  const reply = prompt('回复内容（留空则仅修改状态）：');
  const status = confirm('点击「确定」标记为【已关闭】，点击「取消」标记为【处理中】') ? 'closed' : 'processing';
  const { res, data } = await api('POST', '/api/admin/ticket/' + id, { reply: reply || null, status });
  if (!res.ok) alert((data && data.error) || '失败'); else renderTickets();
}

/* ---------- 运营配置 ---------- */
async function renderOps() {
  $('content').innerHTML = '<p>加载中…</p>';
  const { res, data } = await api('GET', '/api/admin/config');
  if (!res.ok) { $('content').innerHTML = '<p>错误：' + esc(data && data.error) + '</p>'; return; }
  const m = data.growth_multiplier || { base: 1, companion: 2, game: 2.5, vip_bonus: 0.3 };
  const comp = data.compensation_enabled;
  let html = `<div class="card"><h3>成长倍率</h3>
    <label>基础 <input id="m-base" type="number" step="0.1" value="${m.base}"></label>
    <label>陪伴 <input id="m-comp" type="number" step="0.1" value="${m.companion}"></label>
    <label>游戏 <input id="m-game" type="number" step="0.1" value="${m.game}"></label>
    <label>会员加成 <input id="m-vip" type="number" step="0.1" value="${m.vip_bonus}"></label>
    <button onclick="saveMult()">保存倍率</button></div>`;
  html += `<div class="card"><h3>补偿开关</h3>
    <label><input type="checkbox" id="comp-on" ${comp ? 'checked' : ''}> 允许补偿 / 补发</label>
    <button onclick="saveComp()">保存</button></div>`;
  html += '<h3>公告管理</h3><div class="card"><input id="a-title" placeholder="标题"><textarea id="a-body" placeholder="内容"></textarea><button onclick="addAnn()">发布</button></div>';
  html += '<table class="tbl"><tr><th>标题</th><th>内容</th><th>状态</th><th>操作</th></tr>';
  (data.announcements || []).forEach((a) => {
    html += `<tr><td>${esc(a.title)}</td><td>${esc(a.body)}</td><td>${a.active ? '展示中' : '隐藏'}</td>
      <td><button onclick="toggleAnn('${a.id}',${a.active})">${a.active ? '隐藏' : '展示'}</button>
      <button onclick="delAnn('${a.id}')">删除</button></td></tr>`;
  });
  html += '</table>';
  $('content').innerHTML = html;
}
async function saveMult() {
  const v = { base: +$('m-base').value, companion: +$('m-comp').value, game: +$('m-game').value, vip_bonus: +$('m-vip').value };
  const { res, data } = await api('PUT', '/api/admin/config', { growth_multiplier: v });
  if (!res.ok) alert((data && data.error) || '失败'); else { alert('已保存'); renderOps(); }
}
async function saveComp() {
  const v = $('comp-on').checked;
  const { res, data } = await api('PUT', '/api/admin/config', { compensation_enabled: v });
  if (!res.ok) alert((data && data.error) || '失败'); else { alert('已保存'); renderOps(); }
}
async function addAnn() {
  const title = $('a-title').value.trim(), body = $('a-body').value.trim();
  if (!title) { alert('请填写标题'); return; }
  const { res, data } = await api('POST', '/api/admin/announcement', { title, body });
  if (!res.ok) alert((data && data.error) || '失败'); else renderOps();
}
async function toggleAnn(id, active) {
  const { res, data } = await api('PUT', '/api/admin/announcement/' + id, { active: !active });
  if (!res.ok) alert((data && data.error) || '失败'); else renderOps();
}
async function delAnn(id) {
  if (!confirm('确定删除该公告？')) return;
  const { res, data } = await api('DELETE', '/api/admin/announcement/' + id);
  if (!res.ok) alert((data && data.error) || '失败'); else renderOps();
}

boot();
