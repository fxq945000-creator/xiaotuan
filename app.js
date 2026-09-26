/* ============================================================
 *  小团 · 陪伴  —— 主逻辑
 *  实时养成 / 真实天气生病 / 睡懒觉 / 陪伴时长成长上学 / 装扮理发
 * ============================================================ */
const SAVE_KEY = 'xiaotuan_companion';      // 存档键（不带版本，版本写在存档里）
const LEGACY_KEYS = ['xiaotuan_companion_v1'];   // 旧版存档键，启动时自动接管
const SAVE_VER = 3;                        // 当前存档结构版本
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

let S = null;          // 存档
let offsetMs = 0;      // 时间偏移（快进 / 调试）
let tab = 'home';      // 当前页签
let petCooldown = 0;

const now = () => Date.now() + offsetMs;

/* ---------------- 学制：幼儿园 3 年 / 小学 6 年 / 初中 3 年 / 高中 3 年 / 大学 4 年 ----------------
 * 每一「学年」需要固定陪伴分钟（mpy），陪伴模式 x2、玩游戏 x2.5 会让学年推进更快。
 */
function labelFor(g, y) {
  if (g.key === 'baby') return '宝宝期';
  if (g.key === 'college') return YEAR_LABEL.college[Math.min(y, g.years) - 1] || '大一';
  if (YEAR_LABEL[g.key]) return g.name + (YEAR_LABEL[g.key][Math.min(y, g.years) - 1] || '');
  return `${g.name}${y}年级`;
}
function gradeInfo() {
  const b = S.bond; let acc = 0;
  for (let i = 0; i < GRADE_SYS.length; i++) {
    const g = GRADE_SYS[i], span = g.years * g.mpy;
    if (b < acc + span) {
      const year = clamp(Math.floor((b - acc) / g.mpy) + 1, 1, g.years);
      const inYear = (b - acc) - (year - 1) * g.mpy;
      return {
        i, g, year, alumni: false,
        name: labelFor(g, year),
        prog: clamp(inYear / g.mpy, 0, 1),
        toNextYear: g.mpy - inYear,
        toNextStage: (acc + span) - b,
        nextName: year < g.years ? labelFor(g, year + 1) : (GRADE_SYS[i + 1] ? GRADE_SYS[i + 1].name : '毕业'),
      };
    }
    acc += span;
  }
  const last = GRADE_SYS[GRADE_SYS.length - 1];
  return { i: GRADE_SYS.length, g: { key: 'alumni', name: '毕业生', years: 1, mpy: 1, go: '09:00', off: '17:00', desc: '学业完成，开始新生活', course: ['工作', '自习', '兴趣课'] },
    year: 1, alumni: true, name: '毕业生', prog: 1, toNextYear: 0, toNextStage: 0, nextName: '—' };
}
const stageIdx = () => Math.min(gradeInfo().i, GRADE_SYS.length - 1);
const canSchool = () => { const gi = gradeInfo(); return !gi.alumni && gi.i >= 1; };
const toMin = s => { const p = String(s).split(':').map(Number); return p[0] * 60 + p[1]; };

/* ---------------- 校历：周末 + 寒暑假 + 法定节假日 ---------------- */
function holidaysOf(y) {
  const list = [];
  const add = (name, m, d, days) => {
    const s = new Date(y, m - 1, d);
    list.push({ name, s, e: new Date(s.getTime() + days * 864e5 - 1) });
  };
  FIXED_HOLIDAYS.forEach(h => add(h.n, h.m, h.d, h.days));
  add('寒假', 1, 20, 30);   // 1/20 - 2/18
  add('暑假', 7, 1, 62);    // 7/1 - 8/31
  const sf = SPRING_FEST[y] || [2, 10];
  const base = new Date(y, sf[0] - 1, sf[1]);
  const off = n => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
  [['春节', 0, 7], ['端午节', 122, 3], ['中秋节', 220, 3]].forEach(([name, n, days]) => {
    const s = off(n); list.push({ name, s, e: new Date(s.getTime() + days * 864e5 - 1) });
  });
  return list;
}
let _hy = 0, _hl = null;
function holidayOn(date) {
  const y = date.getFullYear();
  if (_hy !== y) { _hl = holidaysOf(y).concat(holidaysOf(y + 1)); _hy = y; }
  const t = date.getTime();
  return _hl.find(h => t >= h.s.getTime() && t <= h.e.getTime()) || null;
}
function schoolStatus(d) {
  const gi = gradeInfo();
  if (gi.i === 0) return { open: false, why: '还没到上学年龄' };
  if (gi.alumni) return { open: false, why: '已经毕业啦' };
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return { open: false, why: '周末休息' };
  const h = holidayOn(d);
  if (h) return { open: false, why: h.name + '假期中', holiday: h };
  return { open: true, why: '' };
}
function nextOpenDay(d) {
  for (let i = 1; i <= 240; i++) {
    const t = new Date(d.getTime() + i * 864e5);
    if (schoolStatus(t).open) return t;
  }
  return null;
}

/* ---------------- 成长倍率 ----------------
 * 默认 x1（与现实时间一致） ｜ 陪伴模式 x2 ｜ 一起玩游戏 x2.5
 */
function accMult() {
  const vb = vipOn() ? VIP_BONUS : 0;   // 会员额外加成
  let m = 1 + vb;
  if (S.acc && S.acc.on) m = Math.max(m, MULT_ACC + vb);
  if (S.boost && S.boost.until > now()) m = Math.max(m, S.boost.mult + vb);
  return m;
}
function startAcc() {
  if (S.acc.on) return;
  S.acc = Object.assign({ since: 0, total: 0, all: 0 }, S.acc, { on: true, since: now(), total: 0 });
  S.mood = clamp(S.mood + 6);
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('span');
    s.className = 'float'; s.textContent = '♥';
    s.style.cssText = `left:${36 + Math.random() * 28}%;top:${44 + Math.random() * 12}%;animation-delay:${i * .1}s`;
    $('#fx-layer').appendChild(s); setTimeout(() => s.remove(), 1600);
  }
  log(`开始陪伴${S.name}，成长值双倍积累中。`, 'good');
  toast('开始陪伴 · 成长 x2.0');
  save(); render();
}
function stopAcc() {
  if (!S.acc.on) return;
  const mins = Math.round(S.acc.total);
  S.acc.on = false;
  log(`结束了这次陪伴，一起待了 ${mins} 分钟。`, '');
  toast(`陪伴结束 · 本次 ${mins} 分钟`);
  save(); render();
}
/* 息屏 / 关闭 App：自动结束陪伴并落盘 */
function endAccByLeave(reason) {
  if (!S.acc || !S.acc.on) { save(); return; }
  if (S.autoEndAcc === false) { save(); return; }
  const mins = Math.round(S.acc.total);
  S.acc.on = false;
  S.acc.lastEnd = { mins, reason, t: now() };
  log(`${reason}，陪伴自动结束（本次 ${mins} 分钟）。`, '');
  save();
}

/* ---------------- 食物 ---------------- */
const mealSlot = () => {
  const h = new Date(now()).getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
};

/* 外出地点 */

/* ---------------- 存档 ---------------- */
function defaultState() {
  const n = Date.now();
  return {
    name: '小团', fur: 'cream', hair: 'short', hairColor: 'brown',
    outfit: 'home', hat: 'none', glasses: 'none', scarf: false,
    hairLen: 5,
    createdAt: n, lastTick: n,
    hunger: 68, mood: 76, energy: 82, clean: 88, health: 100, style: 72,
    bond: 0, coins: 120, knowledge: 0,
    acc: { on: false, since: 0, total: 0, all: 0 },   // 陪伴模式
    autoEndAcc: true,                                 // 息屏 / 关闭 App 时自动结束陪伴
    boost: { mult: 1, until: 0 },                     // 临时成长加成（一起玩游戏）
    // 小游戏纪录：猜拳/打地鼠/翻牌/算术/接球/捉迷藏/学动作/挠痒痒/猜心情
    games: { rps: 0, mole: 0, mem: 0, quiz: 0, catch: 0, hide: 0, mimic: 0, tickle: 0, mood: 0 },
    toys: {}, gacha: 0, toyDone: false,          // 扭蛋机：玩具收藏与累计次数
    sleeping: false, atSchool: false, sick: null,
    out: null,                       // {place, until}
    meals: {}, mealDay: '',
    city: CITIES[3],
    weather: null, weatherAt: 0, weatherHour: -1,
    ownedOutfit: ['home'], ownedHat: ['none'], ownedGlasses: ['none'], ownedHair: ['short', 'bald'],
    school: { days: 0, late: 0, absent: 0, grades: [], lastDay: '', lastTerm: undefined },
    sickCount: 0,
    logs: [], setup: false,
    me: { nick: '我', uid: 'XT' + Math.random().toString(36).slice(2, 8).toUpperCase() },
    vip: { until: 0, bought: 0 },                                   // 会员
    pay: { total: 0, orders: [], first: false },                    // 充值
    signin: { last: '', streak: 0 },                                // 每日签到
    set: { notify: true, sound: true, autoFeed: false, powerSave: false },
    remind: {},                                                     // 各类提醒的上次触发时间
    ver: SAVE_VER,                                                  // 存档结构版本
    ach: {},                                                        // 成就解锁记录 { id: 时间戳 }
    // 行为统计（成就条件用）
    stat: { pet: 0, feed: 0, bath: 0, out: 0, gacha: 0, play: 0, heal: 0, hair: 0, dress: 0, sign: 0 },
    guide: { done: false, step: 0 },                                // 新手引导
  };
}

/* ---------------- 存档版本迁移链 ----------------
 * 每个 key 是「从该版本升到下一版本」的补丁函数。
 * 新增字段只要在 defaultState 里给默认值即可（load 会 Object.assign 兜底），
 * 只有「旧存档里结构不同 / 需要换算 / 需要补嵌套字段」时才写补丁。
 */
const MIGRATIONS = {
  // v1 → v2：早期存档缺 acc / boost / games / toys / vip / pay / signin / set 等字段
  1(s) {
    if (!s.acc) s.acc = { on: false, since: 0, total: 0, all: 0 };
    if (!s.acc.all) s.acc.all = s.acc.total || 0;
    if (s.autoEndAcc === undefined) s.autoEndAcc = true;
    if (!s.boost) s.boost = { mult: 1, until: 0 };
    s.games = Object.assign({ rps: 0, mole: 0, mem: 0, quiz: 0, catch: 0 }, s.games || {});
    ['hide', 'mimic', 'tickle', 'mood'].forEach(k => { if (!s.games[k]) s.games[k] = 0; });
    if (!s.toys) s.toys = {};
    if (typeof s.gacha !== 'number') s.gacha = 0;
    if (s.toyDone === undefined) s.toyDone = false;
    if (!s.me) s.me = { nick: '我', uid: 'XT' + Math.random().toString(36).slice(2, 8).toUpperCase() };
    if (!s.vip) s.vip = { until: 0, bought: 0 };
    if (!s.pay) s.pay = { total: 0, orders: [], first: false };
    if (!s.signin) s.signin = { last: '', streak: 0 };
    if (!s.set) s.set = { notify: true, sound: true, autoFeed: false, powerSave: false };
    [['notify', true], ['sound', true], ['autoFeed', false], ['powerSave', false]]
      .forEach(([k, v]) => { if (s.set[k] === undefined) s.set[k] = v; });
    if (!s.remind) s.remind = {};
    if (!s.weatherHour) s.weatherHour = -1;
    return s;
  },
  // v2 → v3：新增成就 / 行为统计 / 新手引导，字段由 defaultState 兜底，这里只做结构校正
  2(s) {
    if (typeof s.ach !== 'object' || !s.ach) s.ach = {};
    s.stat = Object.assign({ pet: 0, feed: 0, bath: 0, out: 0, gacha: 0, play: 0, heal: 0, hair: 0, dress: 0, sign: 0 }, s.stat || {});
    if (!s.guide) s.guide = { done: false, step: 0 };
    // 老用户已经玩过一阵子了，不再弹新手引导
    if (s.setup) s.guide = { done: true, step: 99 };
    return s;
  },
};
function migrate(s) {
  if (typeof s.ver !== 'number' || !s.ver) s.ver = 1;
  let guard = 0;
  while (s.ver < SAVE_VER && guard++ < 50) {
    const fn = MIGRATIONS[s.ver];
    if (fn) { try { s = fn(s); } catch (e) { console.warn('migrate', s.ver, e); } }
    s.ver += 1;
  }
  s.ver = SAVE_VER;
  return s;
}

let saveWarned = false;
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    if (typeof Cloud !== 'undefined' && Cloud.ready && Cloud.loggedIn) { Cloud.pushState(S).catch(() => {}); }
    return true;
  }
  catch (e) {
    if (!saveWarned) { saveWarned = true; toast('存档写入失败（隐私模式或空间不足），本次进度可能丢失'); }
    return false;
  }
}
function load() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {}
  if (!raw) {   // 接管旧版存档
    for (const k of LEGACY_KEYS) {
      try {
        const r = localStorage.getItem(k);
        if (r) { raw = r; try { localStorage.removeItem(k); } catch (e2) {} break; }
      } catch (e) {}
    }
  }
  if (!raw) { S = defaultState(); return false; }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('bad save');
    S = migrate(Object.assign(defaultState(), parsed));
    return true;
  } catch (e) {
    try { localStorage.setItem(SAVE_KEY + '_broken_' + Date.now(), raw); } catch (e2) {}
    S = defaultState();
    toast('存档损坏，已备份原件并重新开始');
    return false;
  }
}

/* ---------------- 存档导出 / 导入 ---------------- */
function exportSave() {
  const txt = JSON.stringify(S);
  openSheet('导出存档', `<div class="muted">复制下面的文本保存好，换设备时可导入恢复。</div>
    <textarea id="exp" readonly rows="6" style="width:100%;margin-top:10px;font-size:11px;border-radius:10px;border:1px solid var(--line);padding:8px">${esc(txt)}</textarea>
    <div class="row2" style="margin-top:10px">
      <button class="btn block" data-copy type="button">复制</button>
      <button class="btn ghost block" data-dl type="button">下载文件</button>
    </div>`, root => {
    root.querySelector('[data-copy]').onclick = () => {
      const ta = root.querySelector('#exp');
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      if (!ok && navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('已复制')).catch(() => toast('请手动长按选择复制'));
      else toast(ok ? '已复制' : '请手动长按选择复制');
    };
    root.querySelector('[data-dl]').onclick = () => {
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
        a.download = `xiaotuan-${ymd(new Date())}.json`;
        a.click();
      } catch (e) { toast('当前环境不支持下载'); }
    };
  });
}
function openImport() {
  openSheet('导入存档', `<div class="muted">粘贴之前导出的存档文本，会覆盖当前的${esc(S.name)}。</div>
    <textarea id="imp" rows="6" style="width:100%;margin-top:10px;font-size:11px;border-radius:10px;border:1px solid var(--line);padding:8px" placeholder="在这里粘贴存档文本"></textarea>
    <button class="btn block" data-ok type="button" style="margin-top:10px">导入并重启</button>`, root => {
    root.querySelector('[data-ok]').onclick = () => {
      const v = root.querySelector('#imp').value.trim();
      if (!v) return toast('请先粘贴存档文本');
      let obj;
      try { obj = JSON.parse(v); } catch (e) { return toast('文本格式不对，无法解析'); }
      if (!obj || typeof obj !== 'object' || !obj.name) return toast('这不是小团的存档');
      try {
        const next = migrate(Object.assign(defaultState(), obj));
        localStorage.setItem(SAVE_KEY, JSON.stringify(next));
        toast('导入成功，正在重启…');
        setTimeout(() => location.reload(), 600);
      } catch (e) { toast('写入失败，导入未完成'); }
    };
  });
}

/* ---------------- 日志 ---------------- */
function log(text, kind) {
  S.logs.unshift({ t: now(), text, kind: kind || '' });
  if (S.logs.length > 120) S.logs.length = 120;
}
const fmtTime = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ymd = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const bondText = m => m < 60 ? `${m.toFixed(1)}分钟` : m < 1440 ? `${(m / 60).toFixed(1)}小时` : `${(m / 1440).toFixed(1)}天`;

/* ---------------- 天气 ---------------- */
async function loadWeather(silent, prev) {
  const { lat, lon, name } = S.city;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
      + `&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
    const r = await fetch(url);
    const j = await r.json();
    const c = j.current;
    S.weather = {
      temp: Math.round(c.temperature_2m),
      max: Math.round(j.daily.temperature_2m_max[0]),
      min: Math.round(j.daily.temperature_2m_min[0]),
      hum: c.relative_humidity_2m,
      wind: Math.round(c.wind_speed_10m),
      code: c.weather_code,
      kind: codeKind(c.weather_code),
      city: name, live: true,
    };
  } catch (e) {
    S.weather = fakeWeather();
  }
  S.weatherAt = now();
  S.weatherHour = new Date(now()).getHours();
  save(); renderTop();
  if (!silent && S.weather && !S.weather.live) toast('天气服务暂不可用，已使用当地模拟气候');
  if (prev) onWeatherChanged(prev);
}

const weatherAgeText = () => {
  if (!S.weatherAt) return '天气获取中…';
  const m = Math.floor((now() - S.weatherAt) / 60000);
  if (m < 1) return '刚刚更新 · 每 30 分钟自动刷新';
  if (m < 60) return `${m} 分钟前更新 · 每 30 分钟自动刷新`;
  return `${Math.floor(m / 60)} 小时前更新 · 每 30 分钟自动刷新`;
};

/* ---------------- 天气自动刷新 ----------------
 * weatherAt 以前只写不读，导致天气只在启动时拉一次，开一整天也不更新。
 */
let weatherBusy = false;
function weatherDue() {
  if (!S.weatherAt || !S.weather) return true;
  if (now() - S.weatherAt > WEATHER_TTL) return true;
  return (S.weatherHour || -1) !== new Date(now()).getHours();   // 跨整点也刷一次
}
async function tickWeather(force) {
  if (!S || !S.city || weatherBusy) return;
  if (!force && !weatherDue()) return;
  const prev = S.weather;
  weatherBusy = true;
  try { await loadWeather(true, prev); } catch (e) {}
  weatherBusy = false;
}
/* 天气变了要让它有感知：写日记、给穿衣提醒，人在外面时还有可能着凉 */
function onWeatherChanged(prev) {
  const w = S.weather; if (!w) return;
  const dTemp = Math.abs((w.temp || 0) - (prev.temp || 0));
  if (prev.kind === w.kind && dTemp < 5) return;
  log(`天气变了：${W_TEXT[prev.kind] || '—'}${prev.temp}° → ${W_TEXT[w.kind] || '—'}${w.temp}°。`, '');
  const r = weatherRisk();
  if (r && !S.sick) {
    const what = r.type === 'heat' ? '穿得太厚了，小心它中暑' : '穿得有点单薄，小心它着凉';
    toast(`外面${W_TEXT[w.kind] || ''}${w.temp}°：${what}`);
    if (S.out || S.atSchool) maybeSick(0.4);
  }
}
function codeKind(code) {
  if (code === 0 || code === 1) return 'sunny';
  if (code === 2) return 'cloudy';
  if (code === 3) return 'overcast';
  if (code >= 45 && code <= 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return 'cloudy';
}
function fakeWeather() {
  const d = new Date(now()), mo = d.getMonth();
  const base = S.city.lat > 40 ? [ -2, 2, 10, 18, 24, 28, 30, 29, 24, 17, 8, 0 ][mo]
    : S.city.lat < 22 ? [ 20, 21, 24, 27, 30, 31, 31, 31, 30, 28, 25, 21 ][mo]
    : [ 8, 11, 16, 22, 27, 30, 32, 31, 27, 22, 16, 10 ][mo];
  const t = Math.round(base + rnd(-3, 3));
  const kind = t <= 0 ? (Math.random() < .5 ? 'snow' : 'cloudy')
    : t >= 30 ? (Math.random() < .3 ? 'thunder' : 'sunny')
    : pick(['sunny', 'cloudy', 'overcast', 'rain']);
  return { temp: t, max: t + 4, min: t - 5, hum: 60, wind: 2, code: 0, kind, city: S.city.name, live: false };
}

/* 天气 → 生病风险 */
function weatherRisk() {
  const w = S.weather; if (!w || S.sick) return null;
  const of = OUTFITS[S.outfit] || OUTFITS.home;
  const hat = HATS[S.hat] || HATS.none;
  const warm = of.warm + (hat.warm || 0) + (S.scarf ? 1 : 0);
  const rainProof = !!of.rain;
  if (w.temp <= 0 && warm < 3) return { p: .55, type: 'cold', msg: '天寒地冻还穿这么少，冻感冒了' };
  if (w.temp <= 8 && warm < 2) return { p: .45, type: 'cold', msg: '冷风一吹，小团打了个喷嚏' };
  if (w.temp <= 12 && w.kind === 'snow' && warm < 3) return { p: .4, type: 'cold', msg: '玩雪着凉了' };
  if ((w.kind === 'rain' || w.kind === 'thunder') && !rainProof) return { p: .5, type: 'cold', msg: '淋雨回来就感冒了' };
  if (w.temp >= 34 && warm >= 3) return { p: .45, type: 'heat', msg: '大热天捂太厚，中暑了' };
  if (w.temp >= 31 && w.kind === 'sunny' && warm >= 3) return { p: .28, type: 'heat', msg: '太阳太毒，有点中暑' };
  return null;
}
function fallSick(type, msg) {
  S.sick = { type, since: now(), until: now() + rnd(4, 9) * 3600e3 };
  S.sickCount++;
  S.mood = clamp(S.mood - 18); S.health = clamp(S.health - 10);
  log(`${msg}，${S.name}得了${SICK_INFO[type].name}。`, 'bad');
  toast(`${S.name}${msg}`);
}
function maybeSick(mult) {
  const r = weatherRisk();
  if (!r) return;
  if (Math.random() < r.p * (mult || 1)) {
    const type = r.type === 'heat' ? 'heat' : (Math.random() < .3 ? 'fever' : 'cold');
    fallSick(type, r.msg);
  }
}

/* ---------------- 引擎 ---------------- */
function step(m, live) {
  if (m <= 0) return;
  S.lastTick = now();
  // 陪伴时长（仅在线累计），陪伴模式 x2、一起玩游戏 x2.5
  if (live && !document.hidden) {
    const mult = accMult();
    S.bond += m * mult;
    S.grow = (S.grow || 0) + m * (mult - 1);
    if (S.acc.on) {
      S.acc.total += m; S.acc.all += m;
      S.mood = clamp(S.mood + 0.06 * m);
    }
  }
  if (S.boost && S.boost.until && now() > S.boost.until) S.boost = { mult: 1, until: 0 };

  // 自动喂食（设置里开启后，饿了自己买饭）
  if (S.set && S.set.autoFeed && live && !S.sleeping && !S.atSchool && !S.out && S.hunger < 25) {
    const slot = mealSlot();
    const f = (FOODS[slot] || []).slice().sort((a, b) => a.p - b.p)[0];
    if (f && S.coins >= f.p) {
      S.coins -= f.p;
      S.hunger = clamp(S.hunger + f.h);
      S.mood = clamp(S.mood + f.m);
      S.health = clamp(S.health + (f.hp || 0));
      S.meals[slot] = true;
      log(`饿了自己吃了${f.n}（自动喂食）。`, 'good');
      if (live) toast(`${S.name}自己吃了${f.n}`);
    }
  }

  const atSchool = S.atSchool, sleeping = S.sleeping;
  // 睡觉时代谢放缓（原来饱食/清洁照常全速掉，睡一觉必饿到 0 还扣健康）
  const restEat = sleeping ? 0.25 : 1;
  const restClean = sleeping ? 0.3 : 1;
  const restStyle = sleeping ? 0.5 : 1;
  // 饱食
  S.hunger = clamp(S.hunger - (0.42 * (atSchool ? 1.2 : 1) * restEat) * m);
  if (sleeping) S.hunger = Math.max(S.hunger, 8);   // 睡着时靠储备撑着，不会饿到虚脱
  // 精力
  S.energy = clamp(S.energy + (sleeping ? 2.8 : -0.3) * m);
  // 清洁
  S.clean = clamp(S.clean - (atSchool ? 0.26 : 0.2) * restClean * m);
  // 造型
  S.style = clamp(S.style - 0.3 * restStyle * m);
  // 头发
  S.hairLen = clamp(S.hairLen + 0.1 * m, 0, 100);
  // 心情
  let pen = 0;
  if (S.hunger < 22) pen += 0.22;
  if (S.clean < 25) pen += 0.16;
  if (S.style < 30) pen += 0.1;
  if (S.hairLen > 65) pen += 0.08;
  if (S.energy < 22) pen += 0.14;
  if (S.sick) pen += 0.22;
  if (S.mood < 35) pen += 0.05;
  S.mood = clamp(S.mood - (0.1 + pen) * m + (sleeping ? 0.05 : 0) * m);
  // 健康
  if (S.sick) S.health = clamp(S.health - 0.3 * m);
  else if (S.hunger <= 1) S.health = clamp(S.health - 0.25 * m);
  else S.health = clamp(S.health + 0.14 * m);
  // 生病加重 / 自愈
  if (S.sick) {
    if (S.health < 45 && S.sick.type === 'cold') { S.sick.type = 'fever'; log('感冒加重，开始发烧了。', 'bad'); }
    if (now() > S.sick.until) { log(`${S.name}的${SICK_INFO[S.sick.type].name}好了，活蹦乱跳！`, 'good'); S.sick = null; }
  }
  // 外出结束
  if (S.out && now() >= S.out.until) backFromOut();
  // 日程
  schedule();
}

function schedule() {
  const d = new Date(now());
  const hm = d.getHours() * 60 + d.getMinutes();
  const dow = d.getDay(), day = ymd(d);
  if (S.mealDay !== day) { S.mealDay = day; S.meals = {}; S.school.lastDay = ''; }

  // 起床 / 睡懒觉
  if (S.sleeping) {
    if (hm >= 7 * 60 && S.energy >= 62) wakeUp('睡饱了，自己醒了');
    else if (hm >= 10 * 60 + 30) wakeUp('一直睡到快中午才起来');
  }
  // 校历：开学 / 放假切换时记一条日记
  const gi = gradeInfo();
  const st = schoolStatus(d);
  const termTag = st.open ? 'open' : st.why;
  if (S.school.lastTerm !== undefined && S.school.lastTerm !== termTag) {
    log(st.open
      ? `开学啦，今天是${gi.name}的课程（${gi.g.go} 到校）。`
      : `开始放${String(st.why).replace('假期中', '')}假，暂时不用去学校了。`, 'good');
  }
  S.school.lastTerm = termTag;

  // 上学（上课日 + 本学段作息时间）
  if (st.open && !S.atSchool && !S.sick && !S.sleeping && !S.out) {
    const goT = toMin(gi.g.go), offT = toMin(gi.g.off);
    if (hm >= goT && hm < offT) goSchool(hm > goT + 10);
  }
  if (S.atSchool && (hm >= toMin(gi.g.off) || hm < 6 * 60)) backFromSchool();
  // 深夜犯困
  if (!S.sleeping && hm >= 23 * 60 && !S.atSchool) { S.energy = Math.min(S.energy, 30); }
}

function wakeUp(reason) {
  S.sleeping = false;
  S.energy = clamp(S.energy + 12);
  log(reason + '。', '');
  save();
}
function goSchool(late) {
  S.atSchool = true;
  S.school.days++;
  if (late) {
    S.school.late++; S.mood = clamp(S.mood - 9);
    log('起晚了，上学迟到了，被老师说了两句。', 'bad');
    toast('小团上学迟到了');
  } else {
    log('按时到校，开始了今天的课程。', 'good');
  }
  maybeSick(0.7);
  save();
}
function backFromSchool() {
  if (!S.atSchool) return;
  S.atSchool = false;
  const day = ymd(new Date(now()));
  const perf = Math.round(S.mood * 0.45 + S.health * 0.3 + Math.min(S.knowledge, 100) * 0.25 + rnd(-4, 6));
  const label = perf >= 88 ? '优' : perf >= 75 ? '良' : perf >= 60 ? '及格' : '待努力';
  if (S.school.lastDay !== day) {
    S.school.lastDay = day;
    S.school.grades.unshift({ day, perf, label });
    if (S.school.grades.length > 30) S.school.grades.length = 30;
  }
  S.knowledge += Math.round(rnd(6, 12));
  S.coins += 10;
  S.mood = clamp(S.mood + 5); S.hunger = clamp(S.hunger - 22); S.clean = clamp(S.clean - 8);
  log(`放学回家啦，今天表现：${label}（${perf}分），零花钱+10。`, 'good');
  maybeSick(0.6);
  save();
}
function goOut(p) {
  if (S.coins < p.cost) return toast('星星币不够啦');
  if (S.atSchool) return toast('还在上课呢，放学再去');
  if (S.sleeping) return toast('小团睡着了，别吵它');
  S.coins -= p.cost;
  S.out = { place: p.id, until: now() + p.min * 60e3, name: p.name };
  stat('out');
  log(`带${S.name}去${p.name}。`, '');
  toast(`出发：${p.name}`);
  closeSheet(); save(); render();
}
function backFromOut() {
  const p = PLACES.find(x => x.id === S.out.place);
  if (p) {
    S.mood = clamp(S.mood + p.mood);
    S.knowledge += p.know;
    S.clean = clamp(S.clean + p.clean);
    S.hunger = clamp(S.hunger - 14);
    S.energy = clamp(S.energy - 8);
    if (p.style) S.style = clamp(S.style + p.style);
    log(`${p.name}结束回家，心情好了不少。`, 'good');
    maybeSick(1);
  }
  S.out = null; save();
}

/* ---------------- 表情 / 台词 ---------------- */
function expr() {
  if (S.sleeping) return { eyes: 'sleep', mouth: 'zzz', mood: 'sleep', fx: ['zzz'] };
  if (S.sick) return {
    eyes: S.sick.type === 'heat' ? 'dizzy' : 'sick', mouth: 'wave', mood: 'sick',
    fx: [S.sick.type === 'fever' ? 'fever' : 'sweat'],
  };
  if (S.hunger < 22) return { eyes: 'sad', mouth: 'wave', mood: 'sad', fx: ['food'] };
  if (S.clean < 25) return { eyes: 'sad', mouth: 'flat', mood: 'sad', fx: ['sweat'] };
  if (S.energy < 22) return { eyes: 'sleep', mouth: 'o', mood: 'sleep', fx: ['zzz'] };
  if (S.mood < 32) return { eyes: 'sad', mouth: 'frown', mood: 'sad', fx: [] };
  if (S.mood > 80) return { eyes: 'happy', mouth: 'big', mood: 'happy', blush: true, fx: ['heart'] };
  return { eyes: 'open', mouth: 'smile', mood: 'idle', blush: S.mood > 62, fx: [] };
}
function bubble() {
  if (S.sleeping) return pick(['呼…呼…', '让我再睡五分钟…', '（翻了个身）']);
  if (S.sick) return pick(['头好晕…', '难受，想抱抱…', '阿嚏！', '我是不是要吃药了…']);
  if (S.atSchool) return pick(['上课要认真听讲…', '还有两节课就放学了', '今天作业有点多…']);
  if (S.out) return pick(['外面好好玩！', '快看那边！', '还想再玩一会儿']);
  if (S.hunger < 22) return pick(['肚子咕咕叫了…', '想吃东西…', '什么时候开饭呀']);
  if (S.clean < 25) return pick(['身上黏黏的…', '想洗个澡']);
  if (S.hairLen > 65) return pick(['头发好乱，遮住眼睛了', '该去理发了…']);
  if (S.style < 30) return pick(['这一身穿好久了…', '想换件好看的衣服']);
  if (S.acc && S.acc.on) return pick(['有你陪着真好～', '再陪我一会儿嘛', '和你在一起，时间过得最快', '嘿嘿，不想让你走']);
  if (S.energy < 25) return pick(['好困…', '眼皮好重…']);
  if (S.mood > 82) return pick(['今天超开心！', '最喜欢你了', '陪我玩一会儿嘛']);
  return pick(['今天天气不错', '你回来啦', '摸摸头', '我们一会儿做什么？']);
}

/* ---------------- 渲染 ---------------- */
function render() { renderTop(); renderStage(); renderAcc(); renderStats(); renderQuick(); if (tab !== 'home') renderPage(); }

function renderTop() {
  const d = new Date(now());
  $('#sb-time').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const w = S.weather;
  $('#wcard-ic').innerHTML = icon(w ? W_ICON[w.kind] : 'cloud', 22);
  $('#wcard-temp').textContent = w ? `${w.temp}°` : '--°';
  $('#wcard-desc').textContent = w ? `${w.city} · ${W_TEXT[w.kind]}` : '获取天气…';
  $('#coin-val').textContent = S.coins;
  $('#coin-ic').innerHTML = icon('coin', 14);
  const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  $('#date-label').textContent = `${d.getMonth() + 1}/${d.getDate()} ${wk}`;
}
function stageKey() {
  if (S.out) return 'park';
  if (S.atSchool) return 'school';
  if (S.scene && S.scene !== 'home') return S.scene;
  return 'home';
}
function renderBond() {
  const m = accMult();
  $('#bond-val').innerHTML = `${bondText(S.bond)} <span class="multi ${m > 1 ? 'hot' : ''}">x${m.toFixed(1)}</span>`;
  $('#pet-stage').textContent = gradeInfo().name;
}
function renderAcc() {
  const on = S.acc.on, m = accMult();
  const left = S.boost.until > now() ? Math.ceil((S.boost.until - now()) / 60000) : 0;
  const box = $('#acccard');
  box.className = 'acccard' + (on ? ' on' : '');
  box.innerHTML = `
    <div class="acc-l">
      <div class="acc-t">${on ? '陪伴中' : '一起陪伴'}
        <span class="multi ${m > 1 ? 'hot' : ''}">成长 x${m.toFixed(1)}</span>
        ${on ? '<span class="accdots"><i></i><i></i><i></i></span>' : ''}
      </div>
      <div class="acc-s">${on
        ? `本次已陪伴 ${Math.floor(S.acc.total)} 分钟 · 双倍成长中${S.autoEndAcc !== false ? '（息屏/关闭 App 自动结束）' : ''}`
        : '开启后成长值按 2 倍积累（默认与现实时间同步）'}
        ${left ? `<br>一起玩游戏加成还剩 ${left} 分钟（x2.5）` : ''}</div>
    </div>
    <button class="btn ${on ? 'ghost' : ''}" data-act="acc" type="button">${on ? '结束陪伴' : '开始陪伴'}</button>`;
  const b = box.querySelector('[data-act]');
  if (b) b.onclick = () => act('acc');
}
function renderStage() {
  const d = new Date(now());
  const night = d.getHours() >= 19 || d.getHours() < 6;
  const key = stageKey();
  $('#scene').innerHTML = renderScene(key === 'home' ? 'home' : key, S.weather, night);
  $('#pet-layer').innerHTML = renderPet(S, expr());
  const tagMap = { home: night ? '家里 · 晚上' : '家里', school: '学校 · 上课中', park: S.out ? `外出 · ${S.out.name}` : '户外', salon: '理发店', clinic: '诊所' };
  $('#stage-tag').textContent = tagMap[key] || '家里';
  $('#pet-name').textContent = S.name;
  $('#bond-ic').innerHTML = icon('heart', 12);
  renderBond();
  const b = $('#bubble');
  b.hidden = false; b.textContent = bubble();
}
function statDef() {
  return [
    { k: 'hunger', n: '饱食', c: '#FF8A65' },
    { k: 'mood',   n: '心情', c: '#FFB3C6' },
    { k: 'energy', n: '精力', c: '#7FC8A9' },
    { k: 'clean',  n: '清洁', c: '#6C93D6' },
    { k: 'health', n: '健康', c: '#E8705F' },
    { k: 'style',  n: '造型', c: '#A57BD1' },
  ];
}
function renderStats() {
  const low = { hunger: 25, mood: 30, energy: 22, clean: 25, health: 55, style: 30 };
  $('#stats').innerHTML = statDef().map(s => {
    const v = Math.round(S[s.k]); const warn = v < low[s.k];
    return `<div class="stat ${warn ? 'warn' : ''}">
      <div class="st-top"><span>${s.n}</span><b>${v}</b></div>
      <div class="bar ${warn ? 'warn' : ''}"><i style="width:${v}%;background:${s.c}"></i></div>
    </div>`;
  }).join('');
}
function renderQuick() {
  const items = [
    { id: 'feed',  n: '喂食', ic: 'feed', cls: '', warn: S.hunger < 35 || !S.meals[mealSlot()] },
    { id: 'bath',  n: '洗澡', ic: 'bath', cls: 'blue', warn: S.clean < 40 },
    { id: 'sleep', n: S.sleeping ? '叫醒' : '睡觉', ic: 'sleep', cls: 'green', warn: S.sleeping && new Date(now()).getHours() >= 8 },
    { id: 'play',  n: '玩耍', ic: 'game', cls: 'pink', warn: false },
    { id: 'dress', n: '装扮', ic: 'closet', cls: '', warn: S.style < 35 },
    { id: 'hair',  n: '理发', ic: 'scissors', cls: '', warn: S.hairLen > 65 },
    { id: 'med',   n: '看病', ic: 'pill', cls: 'red', warn: !!S.sick },
    { id: 'out',   n: '出门', ic: 'walk', cls: 'green', warn: false },
  ];
  $('#quick').innerHTML = items.map(i =>
    `<button class="qbtn ${i.cls}" data-act="${i.id}" type="button">
      ${i.warn ? '<span class="dot"></span>' : ''}
      <span class="q-ic">${icon(i.ic, 20)}</span>${i.n}</button>`).join('');
  $('#quick').querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act));
}

/* ---------------- 页签与页面 ---------------- */
/* 滚动位置记忆：页签内容是整体重建的，不记住就会每次跳回顶部 */
const scrollMemo = {};
function viewEl() { try { return $('.view'); } catch (e) { return null; } }
function switchTab(next) {
  const v = viewEl();
  if (v && tab) scrollMemo[tab] = v.scrollTop;   // 先记住当前页签的位置
  tab = next; S.scene = 'home';
  $('#home').hidden = tab !== 'home';
  $('#page').hidden = tab === 'home';
  renderTabs();
  if (tab !== 'home') renderPage(true);
  else { render(); if (v) v.scrollTop = scrollMemo.home || 0; }
}
function renderTabs() {
  $('#tabbar').innerHTML = TABS.map(t =>
    `<button class="tab ${tab === t.id ? 'on' : ''}" data-tab="${t.id}" type="button">
      <span class="t-ic">${icon(t.ic, 20)}</span>${t.n}</button>`).join('');
  $('#tabbar').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
}
/* useMemo=true 表示这是切页签，用该页签记住的位置；否则保持当前滚动位置不变 */
function renderPage(useMemo) {
  const el = $('#page');
  const v = viewEl();
  const keep = v ? v.scrollTop : 0;
  if (tab === 'closet') el.innerHTML = pageCloset();
  if (tab === 'school') el.innerHTML = pageSchool();
  if (tab === 'out') el.innerHTML = pageOut();
  if (tab === 'diary') el.innerHTML = pageDiary();
  if (tab === 'me') el.innerHTML = pageMe();
  bindPage();
  if (v) v.scrollTop = (useMemo && scrollMemo[tab] !== undefined) ? scrollMemo[tab] : keep;
}
function bindPage() {
  const p = $('#page');
  p.querySelectorAll('[data-do]').forEach(b => {
    if (b.dataset.v) return;                       // 开关按钮交给下面统一处理
    b.onclick = () => act(b.dataset.do, b.dataset.arg);
  });
  p.querySelectorAll('[data-v]').forEach(b => b.onclick = e => {
    e.stopPropagation(); act(b.dataset.do || 'autoEnd', b.dataset.v);
  });
}

/* 衣橱 */
function itemCard(kind, id, def, owned, on) {
  const need = def.level || 0;
  const stg = gradeInfo().name;
  const locked = !owned && need > stageIdx();
  const price = def.price || 0;
  const thumb = kind === 'hair'
    ? renderPet(Object.assign({}, S, { hair: id, hairLen: 0 }), { eyes: 'happy', mouth: 'smile', mood: 'idle' })
    : renderPet(Object.assign({}, S, kind === 'outfit' ? { outfit: id } : kind === 'hat' ? { hat: id } : { glasses: id }),
      { eyes: 'open', mouth: 'smile', mood: 'idle' });
  return `<button class="gitem ${on ? 'on' : ''} ${locked ? 'lock' : ''}" data-do="${kind}" data-arg="${id}" type="button">
    ${on ? '<span class="badge">穿着</span>' : ''}
    <span class="thumb">${thumb}</span>
    <span>${def.name}</span>
    ${owned ? '<span class="lockmsg">已拥有</span>'
      : locked ? `<span class="lockmsg">${stg}以上解锁</span>`
      : `<span class="price">${icon('coin', 11)}${price}</span>`}
  </button>`;
}
function pageCloset() {
  const st = stageIdx();
  const oft = Object.keys(OUTFITS).map(id => itemCard('outfit', id, OUTFITS[id], S.ownedOutfit.includes(id), S.outfit === id)).join('');
  const hat = Object.keys(HATS).map(id => itemCard('hat', id, HATS[id], S.ownedHat.includes(id), S.hat === id)).join('');
  const gls = Object.keys(GLASSES).map(id => itemCard('glasses', id, GLASSES[id], S.ownedGlasses.includes(id), S.glasses === id)).join('');
  const hair = Object.keys(HAIR_STYLES).map(id => itemCard('hair', id, HAIR_STYLES[id], S.ownedHair.includes(id), S.hair === id)).join('');
  return `<div class="page">
    <h2>衣橱 · 装扮</h2>
    <div class="card">
      <div class="ct">${icon('star', 14)} 造型值 ${Math.round(S.style)} / 100</div>
      <div class="bar"><i style="width:${S.style}%;background:#A57BD1"></i></div>
      <div class="muted" style="margin-top:8px">造型值会随时间下降；换上新装扮会让它心情大好。当前：${gradeInfo().name}</div>
    </div>
    <div class="card"><div class="ct">${icon('closet', 14)} 衣服</div><div class="grid3">${oft}</div></div>
    <div class="card"><div class="ct">${icon('star', 14)} 帽子</div><div class="grid3">${hat}</div></div>
    <div class="card"><div class="ct">${icon('heart', 14)} 眼镜</div><div class="grid3">${gls}</div></div>
    <div class="card">
      <div class="ct">${icon('scissors', 14)} 发型 · 发色</div>
      <button class="opt" data-do="hair" type="button">${icon('scissors', 16)} 去理发店 <span class="muted" style="margin-left:auto">头发长度 ${Math.round(S.hairLen)}%</span></button>
      <div class="grid3">${hair}</div>
    </div>
    ${gachaCard()}
  </div>`;
}

/* ---------------- 扭蛋机：星星币的常驻消耗出口 ---------------- */
const gachaHave = () => GACHA_TOYS.filter(t => (S.toys || {})[t.id] > 0).length;

function rollGacha() {
  const total = GACHA.reduce((s, g) => s + g.w, 0);
  let r = Math.random() * total;
  for (const g of GACHA) { r -= g.w; if (r <= 0) return g; }
  return GACHA[0];
}
function applyGacha(g) {
  S.gacha = (S.gacha || 0) + 1;
  if (g.kind === 'coin') { S.coins += g.v; return `返还 ${g.v} 星星币`; }
  if (g.kind === 'snack') {
    S.mood = clamp(S.mood + g.mood);
    S.hunger = clamp(S.hunger + g.hunger);
    return `心情 +${g.mood} · 饱食 +${g.hunger}`;
  }
  S.toys = S.toys || {};
  const first = !S.toys[g.id];
  S.toys[g.id] = (S.toys[g.id] || 0) + 1;
  return first ? '新玩具！收进玩具柜' : `第 ${S.toys[g.id]} 个，已收进玩具柜`;
}
function checkToySet() {
  if (S.toyDone || gachaHave() < GACHA_TOYS.length) return;
  S.toyDone = true; S.coins += 300; S.mood = clamp(S.mood + 20);
  log('集齐了扭蛋机里全部 5 种玩具，奖励 300 星星币！', 'good');
  toast('玩具收集完成 · 奖励 300 星星币');
}
function gachaCard() {
  const have = gachaHave();
  return `<div class="card">
    <div class="ct">${icon('gift', 14)} 扭蛋机 · 玩具柜</div>
    <div class="toys">${GACHA_TOYS.map(t => {
      const n = (S.toys || {})[t.id] || 0;
      return `<div class="ty ${n ? 'got' : ''}"><span class="ty-e">${n ? t.e : '?'}</span>
        <span class="ty-n">${n ? t.n : '未收集'}</span>${n > 1 ? `<span class="ty-x">x${n}</span>` : ''}</div>`;
    }).join('')}</div>
    <div class="muted" style="margin-top:8px">已收集 ${have}/${GACHA_TOYS.length} 种 · 累计抽了 ${S.gacha || 0} 次
      ${S.toyDone ? ' ｜ <b style="color:var(--accent)">已集齐</b>' : ' ｜ 集齐奖励 300 币'}</div>
    <button class="btn block" data-do="gacha" type="button" style="margin-top:10px">
      ${icon('gift', 14)} 去抽扭蛋（${GACHA_ONE} 币 / 次）</button>
  </div>`;
}
function openGacha() {
  if (S.sleeping) return toast('睡着了，明天再抽');
  if (S.atSchool) return toast('上课呢，放学再玩');
  const body = () => `
    <div class="gs"><span>星星币 <b id="g-c">${S.coins}</b></span><span>已收集 <b>${gachaHave()}</b>/${GACHA_TOYS.length}</span></div>
    <div class="gacha-res" id="g-r"><div class="muted" style="text-align:center;padding:14px 0">点下面的按钮开始抽</div></div>
    <div class="w-btns">
      <button class="btn" data-1 type="button">单抽 · ${GACHA_ONE} 币</button>
      <button class="btn ghost" data-10 type="button">十连 · ${GACHA_TEN} 币</button>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="ct">${icon('star', 14)} 奖品池</div>
      ${GACHA.map(g => `<div class="kv"><span>${g.e} ${g.n}</span><b>${(g.w / GACHA.reduce((s, x) => s + x.w, 0) * 100).toFixed(0)}%</b></div>`).join('')}
    </div>`;
  const paint = (root, list) => {
    const box = root.querySelector('#g-r');
    if (!box) return;
    box.innerHTML = list.length === 1
      ? `<div class="g-one"><span class="g-e">${list[0].g.e}</span>
           <b>${list[0].g.n}</b><span class="muted">${list[0].txt}</span></div>`
      : `<div class="g-ten">${list.map(x => `<div class="g-t"><span>${x.g.e}</span><span>${x.g.n}</span></div>`).join('')}</div>
         <div class="muted" style="text-align:center;margin-top:6px">${list.filter(x => x.g.kind === 'toy').length} 个玩具 · 返还 ${list.reduce((s, x) => s + (x.g.kind === 'coin' ? x.g.v : 0), 0)} 币</div>`;
    const c = root.querySelector('#g-c'); if (c) c.textContent = S.coins;
  };
  openSheet('扭蛋机', body(), root => {
    const draw = n => {
      const list = doGacha(n);
      if (!list) return;
      paint(root, list);
      buzz(25); render(); if (tab === 'closet') renderPage();
    };
    root.querySelector('[data-1]').onclick = () => draw(1);
    root.querySelector('[data-10]').onclick = () => draw(10);
  });
}
/* 抽 n 次（1 或 10），返回奖品列表；币不够返回 null */
function doGacha(n) {
  const cost = n === 10 ? GACHA_TEN : GACHA_ONE * n;
  if (S.coins < cost) { toast('星星币不够啦'); return null; }
  S.coins -= cost;
  const list = [];
  for (let i = 0; i < n; i++) { const g = rollGacha(); list.push({ g, txt: applyGacha(g) }); }
  checkToySet();
  log(`抽了${n === 10 ? '十连' : '一次'}扭蛋，花了 ${cost} 币：${list.map(x => x.g.n).join('、')}。`, '');
  save();
  return list;
}
/* 学校 */
function pageSchool() {
  const gi = gradeInfo(), sg = S.school;
  const d = new Date(now()), hm = d.getHours() * 60 + d.getMinutes();
  const stt = schoolStatus(d);
  const nx = nextOpenDay(d);
  const nxTxt = nx ? `${nx.getMonth() + 1}/${nx.getDate()}` : '—';
  const leftDays = nx ? Math.ceil((nx.setHours(0, 0, 0, 0) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5) : 0;

  let status;
  if (gi.alumni) status = '已经毕业，不用上学啦';
  else if (gi.i === 0) status = `还太小，${gi.g.desc}`;
  else if (!stt.open) status = `${stt.why}，${leftDays > 0 ? `还有 ${leftDays} 天开学（${nxTxt}）` : '不用上学'}`;
  else if (S.sick) status = '生病请假中';
  else if (S.atSchool) status = `正在上课（${gi.g.off} 放学）`;
  else if (S.sleeping) status = '还在睡懒觉！再不起床要迟到了';
  else if (hm < toMin(gi.g.go)) status = `准备上学中（${gi.g.go} 到校）`;
  else status = '今天已经放学啦';

  const grades = sg.grades.length
    ? sg.grades.slice(0, 8).map(g => `<div class="kv"><span>${g.day}</span><b style="color:${g.perf >= 75 ? '#3FA47C' : g.perf >= 60 ? '#D99A2B' : '#E8705F'}">${g.label} ${g.perf}</b></div>`).join('')
    : '<div class="empty">还没有成绩记录</div>';

  return `<div class="page">
    <h2>学校</h2>
    <div class="card">
      <div class="ct">${icon('school', 14)} ${gi.name} · 上学状态</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:8px">${status}</div>
      <div class="muted">${gi.alumni ? '学业完成' : `${gi.g.name}第 ${gi.year} 年 / 共 ${gi.g.years} 年`} ｜ 到校 ${gi.g.go} 放学 ${gi.g.off}</div>
      <div class="muted" style="margin-top:4px">知识值 ${S.knowledge} ｜ 已上学 ${sg.days} 天 ｜ 迟到 ${sg.late} 次</div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn" data-do="toSchool" type="button" ${S.atSchool || !stt.open || S.sick ? 'disabled' : ''}>送去学校</button>
        <button class="btn ghost" data-do="fromSchool" type="button" ${!S.atSchool ? 'disabled' : ''}>接回家</button>
      </div>
    </div>
    <div class="card">
      <div class="ct">${icon('clock', 14)} 学年进度</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700">
        <span>本学年 ${Math.round(gi.prog * 100)}%</span><span>${gi.nextName}</span></div>
      <div class="prog"><i style="width:${stageProgress()}%"></i></div>
      <div class="muted" style="margin-top:6px">${nextStageText()}（陪伴可加速）</div>
    </div>
    <div class="card"><div class="ct">${icon('book', 14)} 今日课表</div>
      ${gi.g.course.map((c, i) => `<div class="kv"><span>第${i + 1}节</span><b>${c}</b></div>`).join('')}
      ${stt.open ? '' : '<div class="muted" style="margin-top:8px">今天放假，没有课</div>'}
    </div>
    <div class="card">
      <div class="ct">${icon('diary', 14)} 校历</div>
      <div class="kv"><span>周末</span><b>周六周日休息</b></div>
      <div class="kv"><span>寒假</span><b>1/20 - 2/18</b></div>
      <div class="kv"><span>暑假</span><b>7/1 - 8/31</b></div>
      <div class="kv"><span>法定假期</span><b>元旦 / 春节 / 清明 / 劳动节 / 端午 / 中秋 / 国庆</b></div>
      <div class="muted" style="margin-top:8px">农历节日按当年春节推算，为近似日期。</div>
    </div>
    <div class="card"><div class="ct">${icon('star', 14)} 最近成绩</div>${grades}</div>
  </div>`;
}
function stageProgress() { return Math.round(gradeInfo().prog * 100); }
function nextStageText() {
  const gi = gradeInfo();
  if (gi.alumni) return '已经毕业啦';
  return `升到${gi.nextName}（还需陪伴 ${bondText(gi.year < gi.g.years ? gi.toNextYear : gi.toNextStage)}）`;
}
/* 出门 */
function pageOut() {
  const w = S.weather;
  const risk = weatherRisk();
  const tips = [];
  if (w) {
    if (w.temp <= 8) tips.push('气温很低，出门记得穿羽绒服、戴帽子围巾。');
    else if (w.temp >= 32) tips.push('天气炎热，别穿太厚，容易中暑。');
    if (w.kind === 'rain' || w.kind === 'thunder') tips.push('有雨，穿雨衣再出门，不然容易感冒。');
    if (w.kind === 'snow') tips.push('下雪天路滑，注意保暖。');
    if (!tips.length) tips.push('天气不错，适合出门走走。');
  }
  return `<div class="page">
    <h2>出门走走</h2>
    <div class="card">
      <div class="ct">${icon('cloud', 14)} ${w ? w.city : '—'} 当前天气 ${w && !w.live ? '（模拟）' : ''}</div>
      ${w ? `<div class="wbig">
          <span style="color:var(--accent)">${icon(W_ICON[w.kind], 40)}</span>
          <span><span class="wbig-t">${w.temp}°</span>
          <div class="muted">${W_TEXT[w.kind]} · ${w.min}° / ${w.max}°</div></span>
        </div>
        <div class="wtips" style="margin-top:10px">湿度 ${w.hum}% ｜ 风 ${w.wind} km/h<br>${tips.join('<br>')}</div>`
      : '<div class="empty">天气获取中…</div>'}
      <button class="btn ghost block" data-do="refreshW" type="button" style="margin-top:10px">刷新天气</button>
      <div class="muted" style="text-align:center;margin-top:6px">${weatherAgeText()}</div>
    </div>
    ${risk ? `<div class="sickcard"><span class="s-ic">${icon('pill', 20)}</span>
      <div><b>当前穿着有风险</b><div class="muted">${risk.msg}（概率约 ${Math.round(risk.p * 100)}%），换件衣服再出门吧</div></div></div>` : ''}
    ${S.out ? `<div class="card"><div class="ct">${icon('walk', 14)} 外出中</div>
      <div style="font-size:14px;font-weight:700">${S.out.name}</div>
      <div class="muted">还有 ${Math.max(0, Math.ceil((S.out.until - now()) / 60000))} 分钟回家</div>
      <button class="btn gray block" data-do="backOut" type="button" style="margin-top:10px">提前回家</button></div>` : ''}
    <div class="card"><div class="ct">${icon('walk', 14)} 去哪儿</div>
      <div class="grid2">${PLACES.map(p =>
        `<button class="gitem" data-do="goOut" data-arg="${p.id}" type="button">
          <span class="thumb" style="height:52px;color:var(--accent)">${icon(p.ic, 26)}</span>
          <span>${p.name}</span>
          <span class="price">${p.cost ? icon('coin', 11) + p.cost : '免费'} · ${p.min}分钟</span>
        </button>`).join('')}</div>
    </div>
  </div>`;
}
/* 日记 */
function pageDiary() {
  const logs = S.logs.slice(0, 40);
  return `<div class="page">
    <h2>成长日记</h2>
    <div class="card">
      <div class="ct">${icon('star', 14)} ${gradeInfo().name}</div>
      <div class="muted">${gradeInfo().alumni ? '学业完成，开始新生活' : `${gradeInfo().g.name}第 ${gradeInfo().year} 年 / 共 ${gradeInfo().g.years} 年 · ${gradeInfo().g.desc}`}</div>
      <div class="prog"><i style="width:${stageProgress()}%"></i></div>
      <div class="muted" style="margin-top:6px">下一步：${nextStageText()}</div>
    </div>
    <div class="card">
      <div class="ct">${icon('heart', 14)} 数据统计</div>
      <div class="kv"><span>累计陪伴</span><b>${bondText(S.bond)}（当前 x${accMult().toFixed(1)}）</b></div>
      <div class="kv"><span>陪伴模式累计</span><b>${bondText(S.acc.all || 0)}（双倍时段）</b></div>
      <div class="kv"><span>认识天数</span><b>${Math.max(1, Math.ceil((now() - S.createdAt) / 86400e3))} 天</b></div>
      <div class="kv"><span>上学天数</span><b>${S.school.days} 天（迟到 ${S.school.late}）</b></div>
      <div class="kv"><span>生病次数</span><b>${S.sickCount} 次</b></div>
      <div class="kv"><span>知识值</span><b>${S.knowledge}</b></div>
      <div class="kv"><span>星星币</span><b>${S.coins}</b></div>
    </div>
    <div class="card">
      <div class="ct">${icon('diary', 14)} 最近发生</div>
      ${logs.length ? logs.map(l => `<div class="log"><span class="l-t">${fmtTime(l.t)}</span>
        <span class="l-x" style="color:${l.kind === 'bad' ? '#E8705F' : l.kind === 'good' ? '#3FA47C' : ''}">${l.text}</span></div>`).join('')
        : '<div class="empty">还没有记录，陪它做点什么吧</div>'}
    </div>
    <div class="card">
      <div class="ct">${icon('gear', 14)} 设置</div>
      <button class="opt" data-do="me" type="button">${icon('user', 16)} 个人设置、充值与会员
        <span class="muted" style="margin-left:auto">去「我的」</span></button>
    </div>
  </div>`;
}

/* ---------------- 我的 ---------------- */
function segRow(label, ic, on, doName, hint) {
  return `<div class="opt">${icon(ic, 16)} ${label}
      <span class="seg" style="width:104px;margin-left:auto">
        <button type="button" class="${on ? 'on' : ''}" data-do="${doName}" data-v="1">开</button>
        <button type="button" class="${!on ? 'on' : ''}" data-do="${doName}" data-v="0">关</button>
      </span></div>
    ${hint ? `<div class="muted" style="padding:0 4px 8px">${hint}</div>` : ''}`;
}
function pageMe() {
  const days = Math.max(1, Math.ceil((now() - S.createdAt) / 864e3));
  const signed = S.signin.last === dayKey(now());
  const on = vipOn(), vd = vipDays();
  const gi = gradeInfo();
  const orders = (S.pay.orders || []).slice(0, 3);
  const pi = pwaInfo();
  return `<div class="page">
    <h2>我的</h2>
    <div class="card me-hero ${on ? 'vip' : ''}">
      <span class="me-av">${renderPet(S, { eyes: 'happy', mouth: 'smile', mood: 'idle' })}</span>
      <div class="me-info">
        <div class="me-nick">${esc(S.me.nick)}${on ? `<span class="viptag">${icon('crown', 11)} VIP</span>` : ''}</div>
        <div class="muted">ID ${S.me.uid} ｜ 陪伴 ${days} 天</div>
        <div class="muted">和${esc(S.name)}（${gi.name}）一起生活</div>
      </div>
      <button class="btn sm ghost" data-do="setNick" type="button">编辑</button>
    </div>

    <div class="card">
      <div class="ct">${icon('wallet', 14)} 我的资产</div>
      <div class="w-row">
        <div><b>${S.coins}</b><span>星星币</span></div>
        <div><b>${S.pay.total || 0}</b><span>累计充值(元)</span></div>
        <div><b>${(S.pay.orders || []).length}</b><span>订单数</span></div>
      </div>
      <div class="w-btns">
        <button class="btn" data-do="recharge" type="button">${icon('coin', 14)} 充值星星币</button>
        <button class="btn ghost" data-do="vip" type="button">${icon('crown', 14)} ${on ? '会员续费' : '开通会员'}</button>
      </div>
      <button class="btn block ${signed ? 'gray' : ''}" data-do="signin" type="button">
        ${signed ? `今日已签到 · 连续 ${S.signin.streak} 天` : `每日签到 ${icon('gift', 13)} 领星星币`}</button>
      <div class="muted" style="margin-top:6px;text-align:center">
        ${signed ? '明天再来，连续签到最多可领 50 币' : `连签 ${(S.signin.streak || 0) + 1} 天可领 ${20 + Math.min(S.signin.streak || 0, 6) * 5}${on ? ' x2' : ''} 币`}
      </div>
    </div>

    <div class="card">
      <div class="ct">${icon('crown', 14)} 会员</div>
      ${on
        ? `<div class="kv"><span>状态</span><b style="color:var(--accent)">生效中 · ${vipDate()} 到期</b></div>
           <div class="kv"><span>剩余</span><b>${vd} 天</b></div>
           <div class="kv"><span>成长加成</span><b>基础 x${(1 + VIP_BONUS).toFixed(1)}，陪伴 x${(2 + VIP_BONUS).toFixed(1)}</b></div>
           <div class="kv"><span>累计开通</span><b>¥${S.vip.bought || 0}</b></div>`
        : `<div class="muted" style="margin-bottom:10px">开通会员：成长值额外 +${VIP_BONUS} 倍，每日签到奖励翻倍。</div>
           <button class="btn block" data-do="vip" type="button">${icon('crown', 14)} 查看会员套餐</button>`}
    </div>

    ${orders.length ? `<div class="card">
      <div class="ct">${icon('clock', 14)} 最近订单</div>
      ${orders.map(o => `<div class="kv"><span>${fmtTime(o.t)} ${o.title}</span><b>${o.coins ? '+' + o.coins + '币' : '会员'} ¥${o.rmb}</b></div>`).join('')}
      <button class="opt" data-do="orders" type="button" style="margin-top:10px">${icon('wallet', 16)} 全部充值记录</button>
    </div>` : ''}

    <div class="card">
      <div class="ct">${icon('gear', 14)} 设置</div>
      <button class="opt" data-do="setNick" type="button">${icon('user', 16)} 我的昵称
        <span class="muted" style="margin-left:auto">${esc(S.me.nick)}</span></button>
      <button class="opt" data-do="rename" type="button">${icon('heart', 16)} 小团的名字
        <span class="muted" style="margin-left:auto">${esc(S.name)}</span></button>
      <button class="opt" data-do="cityPick" type="button">${icon('cloud', 16)} 所在城市
        <span class="muted" style="margin-left:auto">${S.city.name}</span></button>
      ${segRow('提醒通知', 'bell', S.set.notify !== false, 'setNotify',
        '开启后，饿了、生病、该上学、该睡觉时会收到提醒')}
      ${segRow('声音与震动', 'bolt', S.set.sound !== false, 'setSound', '操作时的轻微震动与提示音（成就、到账会响）')}
      ${segRow('自动喂食', 'feed', !!S.set.autoFeed, 'setAutoFeed',
        '饱食度低于 25 时，自动买一份便宜的饭（消耗星星币）')}
      ${segRow('息屏/关闭 App 结束陪伴', 'clock', S.autoEndAcc !== false, 'autoEnd',
        S.autoEndAcc !== false ? '黑屏、切后台、关闭 App 都会自动结束陪伴' : '已关闭：离开后仍保持陪伴状态，回来继续累计')}
      ${segRow('省电模式', 'shield', !!S.set.powerSave, 'setPower', '关闭动画与过渡，更省电')}
      <button class="opt" data-do="ff" type="button">${icon('clock', 16)} 时间快进 1 小时
        <span class="muted" style="margin-left:auto">调试用</span></button>
    </div>

    <div class="card">
      <div class="ct">${icon('bolt', 14)} 应用状态</div>
      <div class="kv"><span>网络</span><b style="color:${pi.online ? 'var(--green)' : 'var(--red)'}">${pi.online ? '在线' : '离线（天气用本地模拟）'}</b></div>
      <div class="kv"><span>离线缓存</span><b>${pi.sw ? '已开启' : (pi.fail || '未开启')}</b></div>
      <div class="kv"><span>运行方式</span><b>${pi.installed ? '桌面应用' : '浏览器'}</b></div>
      <div class="muted" style="padding-top:8px">${pi.sw
      ? '断网也能打开，记得偶尔联网让天气保持最新。'
      : '通过 https 或本地服务器打开时可开启离线缓存，装到桌面后能像 App 一样启动。'}</div>
    </div>

    <div class="card">
      <div class="ct">${icon('star', 14)} 其它</div>
      <button class="opt" data-do="gacha" type="button">${icon('gift', 16)} 扭蛋机
        <span class="muted" style="margin-left:auto">玩具 ${gachaHave()}/${GACHA_TOYS.length}</span></button>
      <button class="opt" data-do="ach" type="button">${icon('medal', 16)} 成就
        <span class="muted" style="margin-left:auto">${achCount()}/${ACH.length}</span></button>
      <button class="opt" data-do="guide" type="button">${icon('book', 16)} 新手引导</button>
      <button class="opt" data-do="orders" type="button">${icon('wallet', 16)} 充值记录
        <span class="muted" style="margin-left:auto">¥${S.pay.total || 0}</span></button>
      <button class="opt" data-do="install" type="button">${icon('home', 16)} 添加到桌面
        <span class="muted" style="margin-left:auto">${pi.installed ? '已安装' : pi.canInstall ? '可安装' : '查看方法'}</span></button>
      <button class="opt" data-do="export" type="button">${icon('shield', 16)} 导出存档</button>
      <button class="opt" data-do="import" type="button">${icon('shield', 16)} 导入存档</button>
      <button class="opt" data-do="about" type="button">${icon('star', 16)} 关于小团
        <span class="muted" style="margin-left:auto">v1.3.0</span></button>
      <button class="opt" data-do="reset" type="button" style="color:var(--red)">${icon('lock', 16)} 重置小团</button>
    </div>
  </div>`;
}

/* ---------------- 成就 ----------------
 * cond(S)  是否达成
 * prog(S)  当前进度数值（用于进度条）
 * goal     目标值          rw 奖励星星币
 */
const achCount = () => ACH.filter(a => S.ach && S.ach[a.id]).length;
// 行为统计 +1（成就条件用）
function stat(k, n) {
  if (!S.stat) S.stat = {};
  S.stat[k] = (S.stat[k] || 0) + (n || 1);
}
function checkAch() {
  if (!S.ach) S.ach = {};
  let first = null, any = false;
  ACH.forEach(a => {
    if (S.ach[a.id]) return;
    let ok = false;
    try { ok = !!a.cond(S); } catch (e) { ok = false; }
    if (!ok) return;
    S.ach[a.id] = now();
    S.coins += a.rw || 0;
    if (!first) first = a;
    any = true;
    log(`解锁成就「${a.n}」${a.rw ? `，+${a.rw} 星星币` : ''}。`, 'good');
  });
  if (any) {
    save();
    toast(`成就达成：${first.n}${first.rw ? ` +${first.rw} 币` : ''}`);
    chime(); renderTop();
    if (tab === 'me') renderPage();
  }
  return any;
}
function openAch() {
  const groups = [...new Set(ACH.map(a => a.gp))];
  const done = achCount();
  const body = `<div class="ach-sum">
      <div class="ach-num">${done}<span>/${ACH.length}</span></div>
      <div class="muted">已解锁 ${done} 个成就 · 共 ${ACH.length} 个</div>
    </div>
    ${groups.map(gp => `<div class="ach-gp">${gp}</div>
      ${ACH.filter(a => a.gp === gp).map(a => {
        const on = !!S.ach[a.id];
        const p = Math.round(clamp((a.prog(S) || 0) / a.goal, 0, 1) * 100);
        return `<div class="ach ${on ? 'on' : ''}">
          <span class="ach-ic">${icon(on ? 'check' : a.ic, 18)}</span>
          <div class="ach-b">
            <div class="ach-n">${a.n}${on ? '' : ` <span class="muted">+${a.rw}币</span>`}</div>
            <div class="muted">${a.d}</div>
            ${on ? `<div class="muted">${ymd(new Date(S.ach[a.id]))} 达成</div>`
                 : `<div class="prog"><i style="width:${p}%"></i></div>`}
          </div></div>`;
      }).join('')}`).join('')}`;
  openSheet('成就', body);
}

/* ---------------- 新手引导 ---------------- */
// 推进引导（抽成函数便于测试）；返回 true 表示已是最后一步
function guideNext(i) {
  const last = i >= GUIDE_STEPS.length - 1;
  S.guide = { done: !!last, step: last ? GUIDE_STEPS.length : i + 1 };
  save();
  if (last) { checkAch(); toast('开始照顾小团吧'); }
  return !!last;
}
function openGuide(step) {
  const i = clamp(step || 0, 0, GUIDE_STEPS.length - 1);
  const s = GUIDE_STEPS[i], last = i === GUIDE_STEPS.length - 1;
  openSheet('新手引导', `
    <div class="guide">
      <span class="guide-ic">${icon(s.ic, 34)}</span>
      <div class="guide-t">${s.t}</div>
      <div class="guide-d">${s.d}</div>
      <div class="guide-dots">${GUIDE_STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row2">
        <button class="btn ghost block" data-skip type="button">跳过</button>
        <button class="btn block" data-next type="button">${last ? '开始照顾小团' : '下一步'}</button>
      </div>
    </div>`, root => {
    root.querySelector('[data-skip]').onclick = () => {
      S.guide = { done: true, step: GUIDE_STEPS.length }; save(); closeSheet();
      toast('随时可以在「我的 → 新手引导」重看');
    };
    root.querySelector('[data-next]').onclick = () => {
      closeSheet(true);
      if (guideNext(i)) return;
      setTimeout(() => openGuide(i + 1), 180);
    };
  });
}

/* ---------------- 动作 ---------------- */
// 睡觉时仍可用的动作（设置、充值、改名等不受影响）
function act(a, arg) {
  if (S.sleeping && !OK_WHEN_SLEEP.includes(a)) { toast('小团睡着了，先叫醒它吧'); return; }
  if (a !== 'pet' && a !== 'ff') buzz(12);
  switch (a) {
    case 'feed': openFeed(); break;
    case 'bath': doBath(); break;
    case 'sleep': S.sleeping ? doWake() : doSleep(); break;
    case 'acc': S.acc.on ? stopAcc() : startAcc(); break;
    case 'play': openGame(); break;
    case 'dress': switchTab('closet'); break;
    case 'hair': openSalon(); break;
    case 'med': openClinic(); break;
    case 'out': switchTab('out'); break;
    case 'toSchool': {
      const stt = schoolStatus(new Date(now()));
      if (!stt.open) return toast(`${stt.why}，今天不用上学`);
      if (S.sleeping) return toast('还在睡懒觉，先叫醒它');
      goSchool(false); toast('把小团送到学校了'); render(); break;
    }
    case 'fromSchool': backFromSchool(); toast('接小团回家'); render(); break;
    case 'goOut': goOut(PLACES.find(p => p.id === arg)); break;
    case 'backOut': S.out.until = now(); backFromOut(); toast('提前回家了'); render(); break;
    case 'refreshW': loadWeather(); toast('正在获取最新天气'); break;
    case 'ff': fastForward(); break;
    case 'autoEnd':
      S.autoEndAcc = arg !== '0';
      save(); toast(S.autoEndAcc ? '已开启：息屏/关闭 App 自动结束陪伴' : '已关闭：离开后仍保持陪伴状态');
      if (tab === 'diary') renderPage();
      break;
    case 'rename': openRename(); break;
    case 'cityPick': openCity(); break;
    case 'reset': openReset(); break;
    case 'me': switchTab('me'); break;
    case 'recharge': openRecharge(); break;
    case 'vip': openVip(); break;
    case 'signin': doSignin(); break;
    case 'orders': openOrders(); break;
    case 'about': openAbout(); break;
    case 'setNick': openNick(); break;
    case 'setNotify':
      S.set.notify = arg !== '0';
      toast(S.set.notify ? '已开启提醒通知' : '已关闭提醒通知');
      save(); if (tab === 'me') renderPage(); break;
    case 'setSound':
      S.set.sound = arg !== '0';
      toast(S.set.sound ? '已开启声音与震动' : '已关闭声音与震动');
      if (S.set.sound) { buzz(30); setTimeout(() => beep(880, 0.12, 'sine', 0.06), 60); }
      save(); if (tab === 'me') renderPage(); break;
    case 'setAutoFeed':
      S.set.autoFeed = arg !== '0';
      toast(S.set.autoFeed ? '已开启自动喂食' : '已关闭自动喂食');
      save(); if (tab === 'me') renderPage(); break;
    case 'setPower':
      S.set.powerSave = arg !== '0';
      applyPowerSave();
      toast(S.set.powerSave ? '省电模式已开启' : '省电模式已关闭');
      save(); if (tab === 'me') renderPage(); break;
    case 'gacha': openGacha(); break;
    case 'ach': openAch(); break;
    case 'guide': openGuide(0); break;
    case 'install': doInstall(); break;
    case 'export': exportSave(); break;
    case 'import': openImport(); break;
    case 'outfit': buyOrWear('outfit', arg); break;
    case 'hat': buyOrWear('hat', arg); break;
    case 'glasses': buyOrWear('glasses', arg); break;
    case 'hair': openSalon(); break;
    case 'pet': petting(); break;
  }
  if (typeof Cloud !== 'undefined' && Cloud.ready && Cloud.loggedIn) {
    const ev = { feed: 'feed', bath: 'bath', gacha: 'gacha', hair: 'hair', dress: 'dress', med: 'heal', toSchool: 'study', out: 'out' }[a];
    if (ev) Cloud.logEvent(ev);
  }
}
function petting() {
  if (Date.now() < petCooldown) return;
  petCooldown = Date.now() + 1200;
  stat('pet');
  const fx = $('#fx-layer');
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    s.className = 'float'; s.textContent = '♥';
    s.style.left = (40 + Math.random() * 22) + '%';
    s.style.top = (46 + Math.random() * 10) + '%';
    s.style.animationDelay = (i * 0.12) + 's';
    fx.appendChild(s); setTimeout(() => s.remove(), 1600);
  }
  if (S.sleeping) {
    S.mood = clamp(S.mood - 4); S.energy = clamp(S.energy - 2);
    showBubble('别闹…让我睡…');
  } else {
    S.mood = clamp(S.mood + 3); S.coins += 1;
    showBubble(pick(['好舒服～', '嘿嘿', '再来一下', '喜欢你摸我']));
  }
  save(); renderStats(); renderStage();
}
function showBubble(t) {
  const b = $('#bubble'); b.hidden = false; b.textContent = t;
  clearTimeout(showBubble._t); showBubble._t = setTimeout(() => { if (b.textContent === t) b.textContent = bubble(); }, 2600);
}

function doBath() {
  if (S.atSchool) return toast('在学校呢，回家再洗');
  if (S.sleeping) return toast('睡着了，别吵它');
  stat('bath');
  S.clean = 100; S.mood = clamp(S.mood + 6); S.coins += 3;
  const fx = $('#fx-layer');
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('span'); s.className = 'float'; s.textContent = '泡泡';
    s.style.cssText = `left:${25 + Math.random() * 50}%;top:${50 + Math.random() * 14}%;font-size:${11 + Math.random() * 6}px;color:#6C93D6;animation-delay:${i * .08}s`;
    fx.appendChild(s); setTimeout(() => s.remove(), 1600);
  }
  log('洗了个泡泡澡，香喷喷。', 'good');
  toast('洗得干干净净'); save(); render();
}
function doSleep() {
  if (S.atSchool) return toast('还在上课，不能睡');
  S.sleeping = true; log('上床睡觉了，晚安。', '');
  toast(S.hunger < 25 ? '睡着了…睡前有点饿，明早记得喂它' : '小团睡着了'); save(); render();
}
function doWake() {
  const h = new Date(now()).getHours();
  S.sleeping = false;
  if (h >= 8 && h < 12 && canSchool() && new Date(now()).getDay() >= 1 && new Date(now()).getDay() <= 5) {
    S.mood = clamp(S.mood - 5); log('被叫醒，还有点迷糊，担心迟到。', 'bad');
  } else {
    S.mood = clamp(S.mood + 2); log('被叫醒了。', '');
  }
  S.energy = clamp(S.energy + 6);
  toast('叫醒小团'); save(); render();
}
function eat(f) {
  if (S.coins < f.p) return toast('星星币不够');
  S.coins -= f.p;
  S.hunger = clamp(S.hunger + f.h);
  S.mood = clamp(S.mood + f.m);
  S.health = clamp(S.health + (f.hp || 0));
  S.meals[mealSlot()] = true;
  stat('feed');
  if (f.junk && Math.random() < .35) fallSick('stomach', '吃太多垃圾食品，肚子疼');
  log(`吃了${f.n}（${SLOT_NAME[mealSlot()]}）。`, 'good');
  closeSheet(); toast(`${S.name}吃得好开心`); save(); render();
}
function buyOrWear(kind, id) {
  const map = { outfit: [OUTFITS, 'ownedOutfit', 'outfit'], hat: [HATS, 'ownedHat', 'hat'], glasses: [GLASSES, 'ownedGlasses', 'glasses'] };
  const [DEF, OWN, KEY] = map[kind];
  const def = DEF[id];
  if (S[OWN].includes(id)) {
    S[KEY] = id; S.style = clamp(S.style + 30); S.mood = clamp(S.mood + 6);
    log(`换上了${def.name}。`, 'good'); toast(`换上${def.name}`);
  } else {
    if ((def.level || 0) > stageIdx()) return toast('阶段不够，还穿不了');
    if (S.coins < def.price) return toast('星星币不够');
    S.coins -= def.price; S[OWN].push(id); S[KEY] = id;
    S.style = clamp(S.style + 40); S.mood = clamp(S.mood + 12);
    log(`买了新${kind === 'outfit' ? '衣服' : kind === 'hat' ? '帽子' : '眼镜'}：${def.name}。`, 'good');
    toast(`购入 ${def.name}`);
  }
  stat('dress');
  save(); render(); if (tab === 'closet') renderPage();
}

/* ---------------- 我的：充值 / 会员 / 签到 / 设置 ---------------- */

const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const vipOn = () => !!(S && S.vip && S.vip.until > now());
const vipDays = () => (S.vip && S.vip.until > now() ? Math.ceil((S.vip.until - now()) / 864e5) : 0);
const vipDate = () => { const d = new Date(S.vip.until); return `${d.getMonth() + 1}/${d.getDate()}`; };
/* 声音：用 Web Audio 合成极短提示音，不需要任何音频素材 */
let acx = null;
function beep(freq, dur, type, vol) {
  if (!S.set || !S.set.sound) return;
  try {
    const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    acx = acx || new AC();
    if (acx.state === 'suspended' && acx.resume) acx.resume();
    const t = acx.currentTime;
    const o = acx.createOscillator(), g = acx.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.07, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.08));
    o.connect(g); g.connect(acx.destination);
    o.start(t); o.stop(t + (dur || 0.08) + 0.02);
  } catch (e) {}
}
function chime() {   // 成就 / 升级 / 到账：三连上行音
  if (!S.set || !S.set.sound) return;
  [659, 880, 1175].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'sine', 0.06), i * 110));
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([18, 55, 18]); } catch (e) {}
}
function buzz(ms) {
  if (!S.set || !S.set.sound) return;
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms || 20); } catch (e) {}
  beep(480 + (ms || 20) * 8, 0.05, 'triangle', 0.035);
}
function applyPowerSave() {
  try { if (typeof document !== 'undefined' && document.body) document.body.classList.toggle('eco', !!(S.set && S.set.powerSave)); } catch (e) {}
}

/* 充值 */
function openRecharge() {
  const first = !S.pay.first;
  openSheet('充值星星币', `
    <div class="muted" style="margin-bottom:10px">当前 ${S.coins} 币${first ? ' · <b style="color:var(--accent)">首充双倍</b>' : ''}　（演示环境，不会产生真实扣款）</div>
    <div class="grid3">${RECHARGE.map(p => `
      <button class="gitem payitem" data-pay="${p.id}" type="button">
        ${p.tag ? `<span class="badge">${p.tag}</span>` : ''}
        <span class="thumb" style="color:var(--accent)">${icon('coin', 26)}</span>
        <span>${p.coins + p.bonus} 币</span>
        <span class="price">¥${p.rmb}</span>
      </button>`).join('')}</div>
    <div class="muted" style="text-align:center;margin-top:12px">选一个档位，进入支付确认</div>`,
    root => { root.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => openPay(b.dataset.pay)); });
}

function openPay(id) {
  const p = RECHARGE.find(x => x.id === id);
  if (!p) return;
  const first = !S.pay.first;
  const gain = p.coins + p.bonus + (first ? p.coins : 0);
  let way = 'wx';
  openSheet('确认支付', `
    <div class="card">
      <div class="ct">${icon('coin', 14)} 订单详情</div>
      <div class="kv"><span>商品</span><b>${p.coins} 星星币</b></div>
      ${p.bonus ? `<div class="kv"><span>赠送</span><b>+${p.bonus} 币</b></div>` : ''}
      ${first ? `<div class="kv"><span>首充双倍</span><b style="color:var(--accent)">+${p.coins} 币</b></div>` : ''}
      <div class="kv"><span>应付金额</span><b>¥${p.rmb}</b></div>
      <div class="kv"><span>实际到账</span><b style="color:var(--accent)">${gain} 币</b></div>
    </div>
    <div class="card">
      <div class="ct">${icon('wallet', 14)} 支付方式</div>
      ${Object.keys(PAY_WAY).map(k => `<button class="opt pm ${k === way ? 'on' : ''}" data-m="${k}" type="button">
        ${icon('wallet', 16)} ${PAY_WAY[k]}<span class="muted" style="margin-left:auto">${k === way ? '已选' : ''}</span></button>`).join('')}
    </div>
    <button class="btn block" data-ok type="button">确认支付 ¥${p.rmb}</button>
    <div class="muted" style="text-align:center;margin-top:8px">演示模式：点击后即时到账</div>`,
    root => {
      root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
        way = b.dataset.m;
        root.querySelectorAll('[data-m]').forEach(x => {
          x.classList.toggle('on', x.dataset.m === way);
          x.querySelector('span').textContent = x.dataset.m === way ? '已选' : '';
        });
      });
      const ok = root.querySelector('[data-ok]');
      ok.onclick = () => {
        ok.disabled = true; ok.textContent = '支付中…';
        setTimeout(() => finishPay(p.rmb, gain, `${p.coins} 星星币`, way, first), 800);
      };
    });
}

function finishPay(rmb, coins, title, way, first) {
  S.coins += coins;
  S.pay.total = (S.pay.total || 0) + rmb;
  S.pay.first = true;
  S.pay.orders.unshift({ t: now(), rmb, coins, title, way: PAY_WAY[way] || way, kind: 'recharge' });
  S.pay.orders = S.pay.orders.slice(0, 30);
  log(`充值成功：${title}，到账 ${coins} 星星币（${PAY_WAY[way] || way}）${first ? '，首充双倍' : ''}。`, 'good');
  closeSheet();
  toast(`到账 ${coins} 星星币`);
  chime(); save(); render(); if (tab === 'me') renderPage();
}

/* 会员 */
function openVip() {
  const on = vipOn();
  openSheet(on ? '会员续费' : '开通会员', `
    <div class="muted" style="margin-bottom:10px">${on
      ? `当前会员有效期至 ${vipDate()}，还有 ${vipDays()} 天，续费会自动往后顺延。`
      : '开通后成长值额外 +0.3 倍，每日签到奖励翻倍。'}</div>
    ${VIP_PLANS.map(p => `<button class="opt pm" data-vip="${p.id}" type="button">
      ${icon('crown', 16)} ${p.name} · ¥${p.rmb}
      ${p.tag ? `<span class="badge2">${p.tag}</span>` : ''}
      <span class="muted" style="margin-left:auto;font-weight:500">${p.days}天</span></button>`).join('')}
    <div class="card" style="margin-top:12px">
      <div class="ct">${icon('star', 14)} 会员权益</div>
      <div class="kv"><span>成长加成</span><b>+${VIP_BONUS} 倍（叠加陪伴/游戏）</b></div>
      <div class="kv"><span>每日签到</span><b>奖励翻倍</b></div>
      <div class="kv"><span>专属标识</span><b>个人主页 VIP 皇冠</b></div>
    </div>`,
    root => { root.querySelectorAll('[data-vip]').forEach(b => b.onclick = () => openVipPay(b.dataset.vip)); });
}

function openVipPay(id) {
  const p = VIP_PLANS.find(x => x.id === id);
  if (!p) return;
  let way = 'wx';
  openSheet(`开通${p.name}`, `
    <div class="card">
      <div class="ct">${icon('crown', 14)} 订单详情</div>
      <div class="kv"><span>商品</span><b>${p.name}（${p.days} 天）</b></div>
      <div class="kv"><span>生效</span><b>${vipOn() ? `续费至 ${vipDate()} 后 ${p.days} 天` : '立即生效'}</b></div>
      <div class="kv"><span>应付金额</span><b>¥${p.rmb}</b></div>
    </div>
    <div class="card">
      <div class="ct">${icon('wallet', 14)} 支付方式</div>
      ${Object.keys(PAY_WAY).map(k => `<button class="opt pm ${k === way ? 'on' : ''}" data-m="${k}" type="button">
        ${icon('wallet', 16)} ${PAY_WAY[k]}<span class="muted" style="margin-left:auto">${k === way ? '已选' : ''}</span></button>`).join('')}
    </div>
    <button class="btn block" data-ok type="button">确认支付 ¥${p.rmb}</button>`,
    root => {
      root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
        way = b.dataset.m;
        root.querySelectorAll('[data-m]').forEach(x => {
          x.classList.toggle('on', x.dataset.m === way);
          x.querySelector('span').textContent = x.dataset.m === way ? '已选' : '';
        });
      });
      const ok = root.querySelector('[data-ok]');
      ok.onclick = () => {
        ok.disabled = true; ok.textContent = '开通中…';
        setTimeout(() => {
          const base = vipOn() ? S.vip.until : now();
          S.vip.until = base + p.days * 864e5;
          S.vip.bought = (S.vip.bought || 0) + p.rmb;
          S.pay.total = (S.pay.total || 0) + p.rmb;
          S.pay.orders.unshift({ t: now(), rmb: p.rmb, coins: 0, title: `${p.name}（${p.days}天）`, way: PAY_WAY[way] || way, kind: 'vip' });
          S.pay.orders = S.pay.orders.slice(0, 30);
          log(`开通了会员${p.name}，有效期至 ${vipDate()}。`, 'good');
          closeSheet(); toast(`${p.name}开通成功，成长加成 +${VIP_BONUS}`); buzz(30);
          save(); render(); if (tab === 'me') renderPage();
        }, 800);
      };
    });
}

/* 每日签到 */
function doSignin() {
  const k = dayKey(now());
  if (S.signin.last === k) return toast('今天已经签到过啦，明天再来');
  const cont = S.signin.last === dayKey(now() - 864e5);
  S.signin.streak = cont ? (S.signin.streak || 0) + 1 : 1;
  S.signin.last = k;
  stat('sign');
  let c = 20 + Math.min(S.signin.streak - 1, 6) * 5;
  const dbl = vipOn();
  if (dbl) c *= 2;
  S.coins += c;
  log(`每日签到 +${c} 星星币（连续 ${S.signin.streak} 天${dbl ? '，会员翻倍' : ''}）。`, 'good');
  toast(`签到成功 +${c} 币${dbl ? '（会员翻倍）' : ''}`);
  chime(); save(); if (typeof Cloud !== 'undefined' && Cloud.ready && Cloud.loggedIn) Cloud.logEvent('sign'); render(); if (tab === 'me') renderPage();
}

/* 订单记录 */
function openOrders() {
  const os = S.pay.orders || [];
  openSheet('充值记录', os.length ? `
    <div class="muted" style="margin-bottom:10px">累计充值 ¥${S.pay.total || 0}　（演示数据）</div>
    ${os.map(o => `<div class="kv"><span>${fmtTime(o.t)} · ${o.title}</span>
      <b>${o.coins ? `+${o.coins} 币` : '会员'} ¥${o.rmb}</b></div>
      <div class="muted" style="font-size:11px;margin:-4px 0 6px">${o.way}</div>`).join('')}`
    : '<div class="empty">还没有充值记录</div>');
}

/* 提醒通知：饿了 / 生病 / 脏了 / 头发长 / 该上学 / 该睡觉，每类 20 分钟最多一次 */
function checkRemind() {
  if (!S || !S.set || S.set.notify === false) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  const d = new Date(now()), hm = d.getHours() * 60 + d.getMinutes();
  const gi = gradeInfo();
  const list = [
    ['sick', !!S.sick, `${S.name}生病了，带它去看医生吧`],
    ['hunger', S.hunger < 25 && !S.atSchool && !S.sleeping, `${S.name}饿了，喂它吃点东西`],
    ['clean', S.clean < 25 && !S.sleeping, `${S.name}有点脏了，洗个澡吧`],
    ['hair', S.hairLen > 70, '头发太长了，带它去理发店'],
    ['school', canSchool() && schoolStatus(d).open && !S.atSchool && !S.sleeping && !S.sick
      && hm >= toMin(gi.g.go) && hm < toMin(gi.g.off), '该上学啦，别迟到'],
    ['sleep', hm >= 22 * 60 + 30 && !S.sleeping, '很晚了，哄它睡觉吧'],
  ];
  for (const [k, onR, msg] of list) {
    if (!onR) continue;
    if (now() - (S.remind[k] || 0) < 20 * 60000) continue;
    S.remind[k] = now();
    toast(msg); buzz(40);
    break;   // 一次只提醒一条，避免刷屏
  }
}

function openAbout() {
  openSheet('关于小团', `
    <div class="card">
      <div class="ct">${icon('star', 14)} 小团 · 陪伴</div>
      <div class="kv"><span>版本</span><b>1.3.0</b></div>
      <div class="kv"><span>存档版本</span><b>v${SAVE_VER}（自动升级）</b></div>
      <div class="kv"><span>存档位置</span><b>本机浏览器，可导出备份</b></div>
      <div class="kv"><span>天气数据</span><b>Open-Meteo</b></div>
      <div class="kv"><span>成就</span><b>${achCount()} / ${ACH.length}</b></div>
      <div class="kv"><span>离线可用</span><b>${pwaInfo().sw ? '已开启' : '未开启（需 https）'}</b></div>
      <div class="kv"><span>会员状态</span><b>${vipOn() ? `有效至 ${vipDate()}` : '未开通'}</b></div>
    </div>
    <div class="muted">这是一个演示原型：充值、支付、会员均为模拟流程，不会发生任何真实交易。成长、天气、校历等玩法都是真实运行的。</div>`);
}

/* ---------------- 弹层 ---------------- */
let sheetLocked = false;   // 首次领养等必须完成的弹层
function openSheet(title, html, mount, lock) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  sheetLocked = !!lock;
  $('#sheet-x').hidden = !!lock;
  $('#sheet-mask').hidden = false;
  if (mount) mount($('#sheet-body'));
}
function closeSheet(force) {
  if (sheetLocked && !force) { toast('先完成这一步吧～'); return; }
  clearGame();
  sheetLocked = false;
  $('#sheet-x').hidden = false;
  $('#sheet-mask').hidden = true;
  if (S && S.scene !== 'home') { S.scene = 'home'; if (tab === 'home') renderStage(); }
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2000);
}

function openFeed() {
  if (S.sleeping) return toast('睡着了，叫醒再吃');
  const slot = mealSlot();
  const list = FOODS[slot];
  const done = S.meals[slot];
  openSheet(`喂${SLOT_NAME[slot]} ${done ? '（今天已吃）' : ''}`,
    `<div class="muted" style="margin-bottom:10px">饱食度 ${Math.round(S.hunger)}/100 ｜ 星星币 ${S.coins}</div>` +
    list.map((f, i) => `<div class="food">
        <span class="f-ic">${icon(slot === 'snack' ? 'heart' : 'feed', 20)}</span>
        <span class="f-main"><b>${f.n}</b><span>${f.d} · 饱食+${f.h} 心情+${f.m} ${f.hp ? (f.hp > 0 ? '健康+' + f.hp : '健康' + f.hp) : ''}</span></span>
        <button class="f-go" data-i="${i}">${icon('coin', 12)} ${f.p}</button>
      </div>`).join('') +
    `<div class="grid2" style="margin-top:6px">${Object.keys(FOODS).filter(k => k !== slot).map(k =>
      `<button class="btn gray" data-slot="${k}">看${SLOT_NAME[k]}</button>`).join('')}</div>`,
    root => {
      root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => eat(list[+b.dataset.i]));
      root.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => {
        const k = b.dataset.slot;
        const l = FOODS[k];
        $('#sheet-title').textContent = `喂${SLOT_NAME[k]}`;
        $('#sheet-body').innerHTML = l.map((f, i) => `<div class="food">
          <span class="f-ic">${icon('feed', 20)}</span>
          <span class="f-main"><b>${f.n}</b><span>${f.d} · 饱食+${f.h} 心情+${f.m}</span></span>
          <button class="f-go" data-j="${i}" data-k="${k}">${icon('coin', 12)} ${f.p}</button></div>`).join('');
        $('#sheet-body').querySelectorAll('[data-j]').forEach(x => x.onclick = () => eat(FOODS[x.dataset.k][+x.dataset.j]));
      });
    });
}

function openRps() {
  if (S.sleeping) return toast('睡着了，明天再玩');
  if (S.atSchool) return toast('上课不能玩游戏');
  openSheet('猜拳 · 三局定胜负', `<div class="muted">赢一局 +6 星星币，输了也有陪伴奖励</div>
    <div class="rps">
      <button data-r="0" type="button">石头</button>
      <button data-r="1" type="button">剪刀</button>
      <button data-r="2" type="button">布</button>
    </div>
    <div class="rps-res" id="rps-res">选择你的出拳</div>
    <div class="muted" id="rps-tip" style="text-align:center">每玩一局都会让成长加速到 x${MULT_GAME}，持续 10 分钟</div>
    <div class="muted" style="text-align:center;margin-top:4px">当前心情 ${Math.round(S.mood)} ｜ 星星币 ${S.coins} ｜ 当前倍率 x${accMult().toFixed(1)}</div>`,
    root => {
      const NM = ['石头', '剪刀', '布'];
      root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
        const me = +b.dataset.r, ai = Math.floor(Math.random() * 3);
        const r = (me - ai + 3) % 3; // 0平 1赢 2输
        let txt;
        if (r === 0) txt = `平局！小团出了${NM[ai]}`;
        else if (r === 1) {
          txt = `你赢了！小团出了${NM[ai]}`; S.coins += 6; S.mood = clamp(S.mood + 9);
          S.games.rps = (S.games.rps || 0) + 1;
        }
        else { txt = `小团赢了！它出了${NM[ai]}`; S.mood = clamp(S.mood + 5); }
        S.energy = clamp(S.energy - 4); S.hunger = clamp(S.hunger - 4);
        S.boost = { mult: MULT_GAME, until: now() + 10 * 60e3 };   // 一起玩 → 2.5 倍成长
        root.querySelector('#rps-res').textContent = txt;
        const tip = root.querySelector('#rps-tip');
        if (tip) tip.textContent = `一起玩得好开心 · 成长 x${MULT_GAME}（10 分钟内有效）`;
        log(`一起玩猜拳：${txt}（成长 x${MULT_GAME}）`, 'good');
        save(); renderStats(); renderAcc(); renderBond();
      });
    });
}

/* ---------------- 小游戏合集 ---------------- */
let gameCleanup = null;
function clearGame() { if (gameCleanup) { try { gameCleanup(); } catch (e) {} gameCleanup = null; } }
/* 延时：关掉弹层时一起取消，避免结算后又被重新弹起 */
function later(fn, ms) { const id = setTimeout(fn, ms); gameCleanup = () => clearTimeout(id); return id; }
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
/* 游戏 id → 开局函数 */
const GAME_FN = {
  rps: () => openRps(), mole: () => openMole(), mem: () => openMem(), quiz: () => openQuiz(),
  catch: () => openCatch(), hide: () => openHide(), mimic: () => openMimic(),
  tickle: () => openTickle(), mood: () => openMood(),
};

/* 统一结算：奖励 + 触发 2.5 倍成长 */
function finishGame(g) {
  stat('play');
  S.coins += g.coins || 0;
  S.mood = clamp(S.mood + (g.mood || 0));
  S.energy = clamp(S.energy - 5);
  S.hunger = clamp(S.hunger - 4);
  if (g.know) S.knowledge += g.know;
  S.boost = { mult: MULT_GAME, until: now() + 10 * 60e3 };
  log(`一起玩「${g.name}」：${g.txt}（成长 x${MULT_GAME}）`, 'good');
  save(); renderStats(); renderAcc(); renderBond(); checkAch();
  if (typeof Cloud !== 'undefined' && Cloud.ready && Cloud.loggedIn) Cloud.logEvent('play', { mins: 1 });
}
function openResult(title, line, reward, again) {
  clearGame();
  openSheet(title, `<div class="card" style="text-align:center">
      <div style="font-size:15px;font-weight:800;margin-bottom:6px">${line}</div>
      <div class="muted">${reward}</div>
      <div class="muted" style="margin-top:8px">一起玩得好开心 · 成长 x${MULT_GAME}（10 分钟内有效）</div>
    </div>
    <button class="btn block" data-a type="button">再来一局</button>
    <button class="btn ghost block" data-b type="button" style="margin-top:8px">换一个游戏</button>
    <button class="btn gray block" data-c type="button" style="margin-top:8px">结束玩耍</button>`,
    root => {
      root.querySelector('[data-a]').onclick = () => (GAME_FN[again] || openGame)();
      root.querySelector('[data-b]').onclick = () => openGame();
      root.querySelector('[data-c]').onclick = () => { closeSheet(); render(); };
    });
}

/* 游戏中心 */
function openGame() {
  if (S.sleeping) return toast('睡着了，明天再玩');
  if (S.atSchool) return toast('上课不能玩游戏');
  clearGame();
  const b = S.games || {};
  const list = [
    { id: 'rps',   n: '猜拳',     d: '一局定胜负',     ic: 'game',   r: b.rps ? `赢过 ${b.rps} 次` : '还没玩过' },
    { id: 'mole',  n: '打地鼠',   d: '30 秒反应力',    ic: 'star',   r: b.mole ? `最高 ${b.mole} 分` : '还没玩过' },
    { id: 'mem',   n: '记忆翻牌', d: '翻出 4 对图案',  ic: 'book',   r: b.mem ? `最少 ${b.mem} 步` : '还没玩过' },
    { id: 'quiz',  n: '算术闯关', d: '5 道题',         ic: 'school', r: b.quiz ? `最高 ${b.quiz} 分` : '还没玩过' },
    { id: 'catch', n: '接球',     d: '看准时机出手',   ic: 'walk',   r: b.catch ? `最高 ${b.catch} 分` : '还没玩过' },
    { id: 'hide',  n: '捉迷藏',   d: '5 轮找到它',     ic: 'home',   r: b.hide ? `最好 ${b.hide}/5` : '还没玩过' },
    { id: 'mimic', n: '学动作',   d: '照着它的顺序做', ic: 'bolt',   r: b.mimic ? `做到第 ${b.mimic} 关` : '还没玩过' },
    { id: 'tickle', n: '挠痒痒',  d: '10 秒狂点它',    ic: 'heart',  r: b.tickle ? `最多 ${b.tickle} 下` : '还没玩过' },
    { id: 'mood',  n: '猜心情',   d: '看表情猜想法',   ic: 'star',   r: b.mood ? `猜对 ${b.mood}/5` : '还没玩过' },
  ];
  openSheet('和小团一起玩', `
    <div class="muted" style="margin-bottom:10px">每玩一局都会让成长加速到 x${MULT_GAME}，持续 10 分钟（当前 x${accMult().toFixed(1)}）</div>
    <div class="games">${list.map(g => `<button class="gcard" data-g="${g.id}" type="button">
      <span class="g-ic">${icon(g.ic, 18)}</span>
      <b>${g.n}</b><span>${g.d}</span><span style="color:var(--accent)">${g.r}</span>
    </button>`).join('')}</div>`,
    root => {
      root.querySelectorAll('[data-g]').forEach(x => x.onclick = () => (GAME_FN[x.dataset.g] || openGame)());
    });
}

/* 打地鼠 */
function openMole() {
  if (S.sleeping) return toast('睡着了，明天再玩');
  if (S.atSchool) return toast('上课不能玩游戏');
  clearGame();
  const fur = FUR_COLORS.find(f => f.id === S.fur) || FUR_COLORS[0];
  openSheet('打地鼠 · 30 秒', `
    <div class="gs"><span>得分 <b id="m-s">0</b></span><span>剩余 <b id="m-t">30</b> 秒</span></div>
    <div class="moles">${Array.from({ length: 6 }, (_, i) =>
      `<div class="mole" data-i="${i}"><span class="mf" style="background:${fur.c}"><i></i><i></i></span></div>`).join('')}</div>
    <div class="muted" style="text-align:center">小团会从洞里冒出来，点它！</div>`,
    root => {
      const holes = Array.from(root.querySelectorAll('.mole'));
      const sEl = root.querySelector('#m-s'), tEl = root.querySelector('#m-t');
      let score = 0, left = 30;
      const pop = () => {
        holes.forEach(h => h.classList.remove('up', 'hit'));
        const h = holes[Math.floor(Math.random() * holes.length)];
        if (h) h.classList.add('up');
      };
      holes.forEach(h => h.onclick = () => {
        if (h.classList.contains('up') && !h.classList.contains('hit')) {
          h.classList.add('hit'); score++; if (sEl) sEl.textContent = score;
        }
      });
      pop();
      const t1 = setInterval(pop, 850);
      const t2 = setInterval(() => { left--; if (tEl) tEl.textContent = left; if (left <= 0) end(); }, 1000);
      gameCleanup = () => { clearInterval(t1); clearInterval(t2); };
      function end() {
        clearGame();
        const coins = Math.min(24, Math.round(score * 0.9));
        const mood = Math.min(16, Math.round(score * 0.9));
        S.games.mole = Math.max(S.games.mole || 0, score);
        finishGame({ name: '打地鼠', coins, mood, txt: `接住小团 ${score} 次` });
        openResult('打地鼠', `接住小团 ${score} 次！`, `+${coins} 星星币 · 心情+${mood}`, 'mole');
      }
    });
}

/* 记忆翻牌 */
function openMem() {
  if (S.sleeping) return toast('睡着了，明天再玩');
  if (S.atSchool) return toast('上课不能玩游戏');
  clearGame();
  const syms = shuffle(['star', 'heart', 'coin', 'sun', 'book', 'cloud', 'bolt', 'bus']).slice(0, 4);
  const deck = shuffle([].concat(syms, syms));
  openSheet('记忆翻牌', `
    <div class="gs"><span>步数 <b id="k-m">0</b></span><span>已配对 <b id="k-d">0</b>/4</span></div>
    <div class="mem">${deck.map((s, i) =>
      `<div class="mi" data-i="${i}" data-s="${s}"><span class="mb">?</span><span class="mf2">${icon(s, 20)}</span></div>`).join('')}</div>
    <div class="muted" style="text-align:center">翻开两张相同的图案就能配对</div>`,
    root => {
      const cards = Array.from(root.querySelectorAll('.mi'));
      const mEl = root.querySelector('#k-m'), dEl = root.querySelector('#k-d');
      let open = [], done = 0, moves = 0, lock = false;
      cards.forEach(c => c.onclick = () => {
        if (lock || c.classList.contains('open') || c.classList.contains('done')) return;
        c.classList.add('open'); open.push(c);
        if (open.length === 2) {
          moves++; if (mEl) mEl.textContent = moves;
          const [a, b] = open; lock = true;
          if (a.dataset.s === b.dataset.s) {
            setTimeout(() => {
              a.classList.add('done'); b.classList.add('done');
              done++; if (dEl) dEl.textContent = done;
              open = []; lock = false;
              if (done === 4) end();
            }, 260);
          } else {
            setTimeout(() => { a.classList.remove('open'); b.classList.remove('open'); open = []; lock = false; }, 620);
          }
        }
      });
      function end() {
        clearGame();
        const coins = Math.max(8, 30 - moves * 2);
        const mood = 14;
        if (!S.games.mem || moves < S.games.mem) S.games.mem = moves;
        finishGame({ name: '记忆翻牌', coins, mood, txt: `${moves} 步翻完 4 对` });
        openResult('记忆翻牌', `${moves} 步全部配对成功！`, `+${coins} 星星币 · 心情+${mood}`, 'mem');
      }
    });
}

/* 算术闯关 */
function makeQ(lv) {
  const ops = lv <= 1 ? ['+', '-'] : lv === 2 ? ['+', '-', '×'] : ['+', '-', '×', '÷'];
  const op = pick(ops);
  let a, b, ans;
  if (op === '+') { a = rndInt(1, lv <= 1 ? 10 : 50); b = rndInt(1, lv <= 1 ? 10 : 50); ans = a + b; }
  else if (op === '-') { a = rndInt(2, lv <= 1 ? 10 : 99); b = rndInt(1, a - 1); ans = a - b; }
  else if (op === '×') { a = rndInt(2, 9); b = rndInt(2, lv >= 3 ? 12 : 9); ans = a * b; }
  else { b = rndInt(2, 9); ans = rndInt(2, 9); a = b * ans; }
  const opts = [ans];
  while (opts.length < 3) { const v = ans + rndInt(-6, 6); if (v >= 0 && !opts.includes(v)) opts.push(v); }
  return { q: `${a} ${op} ${b} = ?`, ans, opts: shuffle(opts) };
}
function openQuiz() {
  if (S.sleeping) return toast('睡着了，明天再玩');
  if (S.atSchool) return toast('上课不能玩游戏');
  clearGame();
  const lv = stageIdx();
  let idx = 0, right = 0, score = 0;
  const next = () => {
    if (idx >= 5) return end();
    const q = makeQ(lv);
    openSheet(`算术闯关 · 第 ${idx + 1}/5 题`, `
      <div class="gs"><span>答对 <b>${right}</b></span><span>得分 <b>${score}</b></span></div>
      <div class="quiz-q">${q.q}</div>
      <div class="quiz-opts">${q.opts.map(o => `<button class="btn ghost" data-o="${o}" type="button">${o}</button>`).join('')}</div>`,
      root => {
        root.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
          const ok = +b.dataset.o === q.ans;
          if (ok) { right++; score += 20; toast('答对了！'); } else { toast(`答案是 ${q.ans}`); }
          idx++; later(next, 420);
        });
      });
  };
  function end() {
    clearGame();
    const coins = Math.round(score / 4);
    const mood = Math.min(15, right * 3);
    S.games.quiz = Math.max(S.games.quiz || 0, score);
    finishGame({ name: '算术闯关', coins, mood, know: right * 2, txt: `答对 ${right}/5 题` });
    openResult('算术闯关', `答对 ${right} / 5 题，${score} 分！`, `+${coins} 星星币 · 心情+${mood} · 知识+${right * 2}`, 'quiz');
  }
  next();
}

/* 接球 */
function openCatch() {
  if (S.sleeping) return toast('睡着了，明天再玩');
  if (S.atSchool) return toast('上课不能玩游戏');
  clearGame();
  let round = 1, score = 0;
  const draw = () => {
    openSheet('接球 · 看准时机', `
      <div class="gs"><span>第 <b>${round}</b>/10 回合</span><span>得分 <b>${score}</b></span></div>
      <div class="track"><span class="zone" id="c-z"></span><span class="mk" id="c-m"></span></div>
      <button class="btn block" id="c-go" type="button">接！</button>
      <div class="muted" id="c-tip" style="text-align:center;margin-top:8px">小球进到绿色区域时按下</div>`,
      root => {
        const go = root.querySelector('#c-go'), tip = root.querySelector('#c-tip');
        go.onclick = () => {
          const mk = root.querySelector('#c-m'), zn = root.querySelector('#c-z');
          let res = 'miss', add = 0;
          if (mk && zn && mk.getBoundingClientRect && zn.getBoundingClientRect) {
            const m = mk.getBoundingClientRect(), z = zn.getBoundingClientRect();
            const mc = m.left + m.width / 2;
            if (mc >= z.left && mc <= z.right) {
              const rel = Math.abs(mc - (z.left + z.width / 2)) / (z.width / 2);
              if (rel < 0.35) { res = 'perfect'; add = 10; } else { res = 'good'; add = 6; }
            }
          }
          score += add;
          if (tip) tip.textContent = res === 'perfect' ? '完美！+10' : res === 'good' ? '不错！+6' : '没接住…';
          round++;
          later(() => { round > 10 ? end() : draw(); }, 520);
        };
      });
  };
  function end() {
    clearGame();
    const coins = Math.round(score / 5);
    const mood = Math.min(15, Math.round(score / 6));
    S.games.catch = Math.max(S.games.catch || 0, score);
    finishGame({ name: '接球', coins, mood, txt: `得分 ${score}` });
    openResult('接球', `10 回合共 ${score} 分！`, `+${coins} 星星币 · 心情+${mood}`, 'catch');
  }
  draw();
}

/* ---------------- 新增互动游戏 ---------------- */
function gameBlocked() {
  if (S.sleeping) { toast('睡着了，明天再玩'); return true; }
  if (S.atSchool) { toast('上课不能玩游戏'); return true; }
  return false;
}

/* 捉迷藏：9 个藏身处，5 轮，找到小团 */
function openHide() {
  if (gameBlocked()) return;
  clearGame();
  let round = 1, found = 0;
  const ROUNDS = 5;
  const draw = () => {
    const here = rndInt(0, HIDE_SPOTS.length - 1);
    const hint = ['左边', '中间', '右边'][here % 3];
    openSheet(`捉迷藏 · 第 ${round}/${ROUNDS} 轮`, `
      <div class="gs"><span>找到 <b>${found}</b></span><span>第 <b>${round}</b>/${ROUNDS} 轮</span></div>
      <div class="hidegrid">${HIDE_SPOTS.map((s, i) =>
        `<button class="hitem" data-i="${i}" type="button"><span class="hv">${s}</span></button>`).join('')}</div>
      <div class="muted" style="text-align:center">提示：它好像躲在${hint}　点开看看！</div>`,
      root => {
        root.querySelectorAll('.hitem').forEach(b => b.onclick = () => {
          if (b.classList.contains('open')) return;
          const i = +b.dataset.i;
          b.classList.add('open');
          if (i === here) {
            b.classList.add('here');
            b.innerHTML = `<span class="hv">${renderPet(S, { eyes: 'happy', mouth: 'big', mood: 'happy', blush: true, fx: ['heart'] })}</span>`;
            found++; toast('找到啦！');
          } else {
            b.classList.add('miss');
            toast(`这里没有…（在${hint}那边）`);
          }
          round++;
          later(() => { round > ROUNDS ? end() : draw(); }, 620);
        });
      });
  };
  function end() {
    clearGame();
    const coins = found * 5, mood = Math.min(15, found * 3);
    S.games.hide = Math.max(S.games.hide || 0, found);
    finishGame({ name: '捉迷藏', coins, mood, txt: `5 轮里找到 ${found} 次` });
    openResult('捉迷藏', `${ROUNDS} 轮里找到小团 ${found} 次！`, `+${coins} 星星币 · 心情+${mood}`, 'hide');
  }
  draw();
}

/* 学动作：小团做一串动作，你照着做（Simon Says） */
function openMimic() {
  if (gameBlocked()) return;
  clearGame();
  const MAX = 8;
  let seq = [], step = 0, lives = 3, best = 0, busy = false;
  const btns = () => MIMIC_ACTS.map(a => `<button class="mbtn" data-a="${a.id}" type="button">
      <span class="me">${a.e}</span><span>${a.n}</span></button>`).join('');

  /* grow=true 表示过关后加长序列；做错了就重放当前这一串 */
  const play = grow => {
    if (grow) seq.push(MIMIC_ACTS[rndInt(0, MIMIC_ACTS.length - 1)].id);
    step = 0; busy = true;
    openSheet(`学动作 · 第 ${seq.length}/${MAX} 关`, `
      <div class="gs"><span>记住顺序 <b>${seq.length}</b> 个</span><span>机会 <b>${lives}</b></span></div>
      <div class="mimic">${btns()}</div>
      <div class="muted" id="mm-tip" style="text-align:center">小团正在做动作，看好啦…</div>`,
      root => {
        const cells = {};
        root.querySelectorAll('.mbtn').forEach(b => cells[b.dataset.a] = b);
        const tip = root.querySelector('#mm-tip');
        let k = 0;
        const timers = [];
        const lit = id => {
          const b = cells[id]; if (!b) return;
          b.classList.add('lit');
          timers.push(setTimeout(() => b.classList.remove('lit'), 340));
        };
        const iv = setInterval(() => {
          if (k < seq.length) { lit(seq[k]); k++; }
          else {
            clearInterval(iv); busy = false;
            if (tip) tip.textContent = '轮到你了，按顺序点一遍！';
          }
        }, 480);
        gameCleanup = () => { clearInterval(iv); timers.forEach(clearTimeout); };
        root.querySelectorAll('.mbtn').forEach(b => b.onclick = () => {
          if (busy) return;
          const id = b.dataset.a;
          b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 200);
          if (id === seq[step]) {
            step++;
            if (step >= seq.length) {
              best = seq.length;
              busy = true;
              if (tip) tip.textContent = '一模一样！下一关…';
              later(() => { seq.length >= MAX ? end() : play(true); }, 700);
            }
          } else {
            lives--;
            busy = true;
            if (tip) tip.textContent = `错啦，正确答案是「${MIMIC_ACTS.find(a => a.id === seq[step]).n}」`;
            later(() => { lives <= 0 ? end() : play(false); }, 900);
          }
        });
      });
  };
  function end() {
    clearGame();
    const coins = Math.min(26, best * 4 + (best >= MAX ? 6 : 0));
    const mood = Math.min(16, best * 2);
    S.games.mimic = Math.max(S.games.mimic || 0, best);
    finishGame({ name: '学动作', coins, mood, txt: best >= MAX ? '全部通关！' : `做到第 ${best} 关` });
    openResult('学动作', best >= MAX ? `厉害！${MAX} 关全通关！` : `小团和你做到了第 ${best} 关`, `+${coins} 星星币 · 心情+${mood}`, 'mimic');
  }
  play(true);
}

/* 挠痒痒：10 秒疯狂点小团 */
function openTickle() {
  if (gameBlocked()) return;
  clearGame();
  let taps = 0, left = 10;
  const LINES = ['哈哈哈～', '痒痒！', '别挠了～', '嘿嘿嘿', '好痒呀！', '再摸一下'];
  openSheet('挠痒痒 · 10 秒', `
    <div class="gs"><span>摸了 <b id="t-n">0</b> 下</span><span>剩余 <b id="t-t">10</b> 秒</span></div>
    <div class="tick-wrap"><div class="tick-pet" id="t-pet">
      ${renderPet(S, { eyes: 'happy', mouth: 'big', mood: 'happy', blush: true, fx: ['heart'] })}
      <div class="tick-fx" id="t-fx"></div>
    </div></div>
    <div class="muted" id="t-tip" style="text-align:center">快点它！看它笑成什么样</div>`,
    root => {
      const pet = root.querySelector('#t-pet'), fx = root.querySelector('#t-fx');
      const nEl = root.querySelector('#t-n'), tEl = root.querySelector('#t-t');
      const timers = [];
      pet.onclick = () => {
        if (left <= 0) return;
        taps++; if (nEl) nEl.textContent = taps;
        S.mood = clamp(S.mood + 0.4);
        pet.classList.remove('shake'); void pet.offsetWidth; pet.classList.add('shake');
        const s = document.createElement('span');
        s.className = 'tpop'; s.textContent = Math.random() < 0.5 ? '♥' : pick(LINES);
        s.style.left = (28 + Math.random() * 44) + '%';
        fx.appendChild(s);
        timers.push(setTimeout(() => s.remove(), 900));
        if (taps % 6 === 0 && root.querySelector('#t-tip')) root.querySelector('#t-tip').textContent = pick(LINES);
      };
      const iv = setInterval(() => {
        left--; if (tEl) tEl.textContent = Math.max(0, left);
        if (left <= 0) end();
      }, 1000);
      gameCleanup = () => { clearInterval(iv); timers.forEach(clearTimeout); };
      function end() {
        clearGame();
        const coins = Math.min(20, Math.round(taps / 3));
        const mood = Math.min(15, Math.round(taps / 4));
        S.games.tickle = Math.max(S.games.tickle || 0, taps);
        finishGame({ name: '挠痒痒', coins, mood, txt: `被摸了 ${taps} 下` });
        openResult('挠痒痒', `10 秒摸了 ${taps} 下，小团笑翻了！`, `+${coins} 星星币 · 心情+${mood}`, 'tickle');
      }
    });
}

/* 猜心情：看小团的表情，猜它在想什么 */
function openMood() {
  if (gameBlocked()) return;
  clearGame();
  let idx = 0, right = 0;
  const TOTAL = 5;
  const next = () => {
    if (idx >= TOTAL) return end();
    const ans = pick(MOODS);
    const opts = shuffle([ans].concat(shuffle(MOODS.filter(m => m.id !== ans.id)).slice(0, 3)));
    openSheet(`猜心情 · 第 ${idx + 1}/${TOTAL} 题`, `
      <div class="gs"><span>答对 <b>${right}</b></span><span>第 <b>${idx + 1}</b>/${TOTAL} 题</span></div>
      <div class="moodpet">${renderPet(S, ans.f)}</div>
      <div class="moodopts">${opts.map(m => `<button class="btn ghost" data-m="${m.id}" type="button">${m.n}</button>`).join('')}</div>`,
      root => {
        root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
          if (b.dataset.m === ans.id) { right++; toast('猜对了！它就是这个表情'); }
          else toast(`不对哦，它现在「${ans.n}」`);
          idx++; later(next, 520);
        });
      });
  };
  function end() {
    clearGame();
    const coins = right * 5, mood = Math.min(14, right * 3);
    S.games.mood = Math.max(S.games.mood || 0, right);
    finishGame({ name: '猜心情', coins, mood, know: right, txt: `猜对 ${right}/${TOTAL} 次` });
    openResult('猜心情', `5 道题猜对 ${right} 题！`, `+${coins} 星星币 · 心情+${mood} · 知识+${right}`, 'mood');
  }
  next();
}

function openSalon() {
  const cur = HAIR_STYLES[S.hair] || HAIR_STYLES.short;
  S.scene = 'salon'; if (tab === 'home') renderStage();
  openSheet('理发店', `
    <div class="muted" style="margin-bottom:8px">当前发型：${cur.name} ｜ 头发长度 ${Math.round(S.hairLen)}%（越长越乱，心情会下降）</div>
    <div class="card">
      <div class="ct">${icon('scissors', 14)} 选发型</div>
      <div class="grid3">${Object.keys(HAIR_STYLES).map(id => {
        const h = HAIR_STYLES[id];
        const owned = S.ownedHair.includes(id);
        const on = S.hair === id;
        return `<button class="gitem ${on ? 'on' : ''}" data-h="${id}" type="button">
          ${on ? '<span class="badge">当前</span>' : ''}
          <span class="thumb">${renderPet(Object.assign({}, S, { hair: id, hairLen: 0 }), { eyes: 'happy', mouth: 'smile', mood: 'idle' })}</span>
          <span>${h.name}</span>
          <span class="${owned ? 'lockmsg' : 'price'}">${owned ? '已解锁' : icon('coin', 11) + h.price}</span>
        </button>`;
      }).join('')}</div>
    </div>
    <div class="card">
      <div class="ct">${icon('star', 14)} 染发</div>
      <div class="grid3">${HAIR_COLORS.map(c =>
        `<button class="gitem ${S.hairColor === c.id ? 'on' : ''}" data-c="${c.id}" type="button">
          <span class="thumb" style="background:${c.c}"></span><span>${c.name}</span><span class="lockmsg">${icon('coin', 11)}15</span>
        </button>`).join('')}</div>
    </div>`,
    root => {
      root.querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
        const id = b.dataset.h, h = HAIR_STYLES[id];
        if (!S.ownedHair.includes(id)) {
          if (S.coins < h.price) return toast('星星币不够');
          S.coins -= h.price; S.ownedHair.push(id);
        } else if (S.coins < 10) return toast('剪发需要 10 星星币');
        else S.coins -= 10;
        stat('hair');
        S.hair = id; S.hairLen = 0; S.style = clamp(S.style + 25); S.mood = clamp(S.mood + 8);
        log(`去理发店做了新发型：${h.name}。`, 'good');
        toast(`新发型：${h.name}`); closeSheet(); save(); render(); if (tab === 'closet') renderPage();
      });
      root.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
        if (S.coins < 15) return toast('星星币不够');
        S.coins -= 15; S.hairColor = b.dataset.c; S.style = clamp(S.style + 10); S.mood = clamp(S.mood + 4);
        const c = HAIR_COLORS.find(x => x.id === b.dataset.c);
        log(`把头发染成了${c.name}。`, 'good');
        toast(`染发：${c.name}`); closeSheet(); save(); render(); if (tab === 'closet') renderPage();
      });
    });
}

function openClinic() {
  S.scene = 'clinic'; if (tab === 'home') renderStage();
  if (!S.sick) {
    openSheet('小诊所', `<div class="card"><div class="ct">${icon('check', 14)} 健康检查</div>
      <div class="kv"><span>健康值</span><b>${Math.round(S.health)} / 100</b></div>
      <div class="kv"><span>生病次数</span><b>${S.sickCount} 次</b></div>
      <div class="muted" style="margin-top:10px">${S.health > 85 ? '身体很棒，继续保持！' : S.health > 60 ? '有点虚弱，注意吃饭和保暖。' : '状态不太好，建议买点营养品。'}</div></div>
      <button class="btn block" data-do2="tonic" type="button" style="margin-top:6px">${icon('coin', 14)} 买营养品（20币，健康+18）</button>
      <div class="muted" style="margin-top:10px">预防胜于治疗：出门看天气穿衣，别让它饿着。</div>`,
      root => {
        root.querySelector('[data-do2]').onclick = () => {
          if (S.coins < 20) return toast('星星币不够');
          S.coins -= 20; S.health = clamp(S.health + 18); S.mood = clamp(S.mood + 3);
          log('买了营养品，补充体力。', 'good'); closeSheet(); save(); render();
        };
      });
    return;
  }
  const info = SICK_INFO[S.sick.type];
  openSheet(`小团${info.name}了`, `
    <div class="sickcard"><span class="s-ic">${icon(info.ic, 20)}</span>
      <div><b>${info.name}</b><div class="muted">${info.tip} · 健康 ${Math.round(S.health)}</div></div></div>
    <div class="muted" style="margin-bottom:10px">不吃药大约 ${Math.max(1, Math.round((S.sick.until - now()) / 3600e3))} 小时后自愈；病情加重会转成发烧。</div>
    <button class="btn block" data-do2="med" type="button">${icon('coin', 14)} 吃药（15币，立刻好转）</button>
    <button class="btn ghost block" data-do2="doc" type="button" style="margin-top:8px">${icon('coin', 14)} 看医生（35币，完全康复）</button>
    <button class="btn gray block" data-do2="rest" type="button" style="margin-top:8px">让它自己扛一扛</button>`,
    root => {
      root.querySelectorAll('[data-do2]').forEach(b => b.onclick = () => {
        const k = b.dataset.do2;
        if (k === 'med') {
          if (S.coins < 15) return toast('星星币不够');
          stat('heal');
          S.coins -= 15; S.sick = null; S.health = clamp(S.health + 12); S.mood = clamp(S.mood + 6);
          log('吃了药，精神好多了。', 'good'); toast('吃药后好转');
        } else if (k === 'doc') {
          if (S.coins < 35) return toast('星星币不够');
          stat('heal');
          S.coins -= 35; S.sick = null; S.health = 100; S.mood = clamp(S.mood + 12);
          log('去看医生，完全康复了。', 'good'); toast('完全康复');
        } else {
          S.sick.until = Math.min(S.sick.until, now() + 3600e3);
          log('决定让它自己扛一扛。', ''); toast('好好休息');
        }
        closeSheet(); save(); render();
      });
    });
}

function openNick() {
  openSheet('编辑我的资料', `<div class="opt">昵称<input id="nk" value="${esc(S.me.nick)}" maxlength="10"></div>
    <div class="opt">UID<span class="muted" style="margin-left:auto">${S.me.uid}</span></div>
    <div class="muted" style="margin-bottom:10px">UID 是随机生成的，暂不支持修改。</div>
    <button class="btn block" data-ok type="button">保存</button>`, root => {
    root.querySelector('[data-ok]').onclick = () => {
      const v = root.querySelector('#nk').value.trim();
      if (v) { S.me.nick = v; log(`把我的昵称改成了「${v}」。`); save(); render(); if (tab === 'me') renderPage(); }
      closeSheet();
    };
  });
}
function openRename() {
  openSheet('给小团改名', `<div class="opt">名字<input id="nn" value="${esc(S.name)}" maxlength="6"></div>
    <button class="btn block" data-ok type="button">保存</button>`, root => {
    root.querySelector('[data-ok]').onclick = () => {
      const v = root.querySelector('#nn').value.trim();
      if (v) { S.name = v; log(`改名为「${v}」。`); save(); render(); if (tab === 'diary') renderPage(); }
      closeSheet();
    };
  });
}
function openCity() {
  openSheet('选择城市', `<div class="muted" style="margin-bottom:10px">天气会根据所选城市的真实气候影响小团的健康</div>
    <div class="grid2">${CITIES.map(c => `<button class="gitem ${S.city.name === c.name ? 'on' : ''}" data-c="${c.name}" type="button">
      <span class="thumb" style="height:44px;color:var(--accent)">${icon('cloud', 22)}</span><span>${c.name}</span></button>`).join('')}</div>
    <button class="btn ghost block" data-gps type="button" style="margin-top:10px">使用我的定位</button>`,
    root => {
      root.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
        S.city = CITIES.find(c => c.name === b.dataset.c);
        log(`搬到了${S.city.name}。`, ''); closeSheet(); loadWeather(); save(); render();
      });
      root.querySelector('[data-gps]').onclick = () => {
        if (!navigator.geolocation) return toast('设备不支持定位');
        toast('正在定位…');
        navigator.geolocation.getCurrentPosition(async p => {
          S.city = { name: '我的位置', lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4) };
          try {
            const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${S.city.lat}&longitude=${S.city.lon}&localityLanguage=zh`);
            const j = await r.json();
            if (j.city || j.locality) S.city.name = j.city || j.locality;
          } catch (e) {}
          closeSheet(); log(`搬到了${S.city.name}。`, ''); loadWeather(); save(); render();
        }, () => toast('定位失败，请手动选择城市'));
      };
    });
}
function openReset() {
  openSheet('重置小团', `<div class="muted" style="margin-bottom:12px">会清空所有成长记录、服装和星星币，确定吗？</div>
    <button class="btn block" data-y type="button" style="background:var(--red)">确定重置</button>
    <button class="btn gray block" data-n type="button" style="margin-top:8px">再想想</button>`,
    root => {
      root.querySelector('[data-y]').onclick = () => { localStorage.removeItem(SAVE_KEY); location.reload(); };
      root.querySelector('[data-n]').onclick = closeSheet;
    });
}

/* 首次 setup */
function openSetup() {
  openSheet('领养一只小团', `
    <div class="muted" style="margin-bottom:10px">给它取个名字，挑个毛色和城市，就开始你们的陪伴吧。</div>
    <div class="opt">名字<input id="nn" value="小团" maxlength="6"></div>
    <div class="card"><div class="ct">毛色</div>
      <div class="grid3">${FUR_COLORS.map(f => `<button class="gitem ${S.fur === f.id ? 'on' : ''}" data-f="${f.id}" type="button">
        <span class="thumb" style="background:${f.c}"></span><span>${f.name}</span></button>`).join('')}</div></div>
    <div class="card"><div class="ct">所在城市（影响天气）</div>
      <div class="grid3">${CITIES.slice(0, 6).map(c => `<button class="gitem ${S.city.name === c.name ? 'on' : ''}" data-c="${c.name}" type="button">
        <span class="thumb" style="height:40px;color:var(--accent)">${icon('cloud', 20)}</span><span>${c.name}</span></button>`).join('')}</div></div>
    <button class="btn block" data-ok type="button">开始陪伴</button>`,
    root => {
      root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
        S.fur = b.dataset.f;
        root.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x.dataset.f === S.fur));
        $('#sheet-title').textContent = '领养一只小团';
      });
      root.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
        S.city = CITIES.find(c => c.name === b.dataset.c);
        root.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x.dataset.c === S.city.name));
      });
      root.querySelector('[data-ok]').onclick = () => {
        const v = root.querySelector('#nn').value.trim();
        S.name = v || '小团'; S.setup = true;
        S.logs = [{ t: now(), text: `${S.name}来到你身边啦，多多陪陪它吧。`, kind: 'good' }];
        closeSheet(true); save(); loadWeather(true); render();
        toast(`欢迎 ${S.name}！`);
        checkAch();                                   // 「初次见面」
        if (!S.guide || !S.guide.done) setTimeout(() => openGuide(S.guide ? S.guide.step : 0), 700);
      };
    }, true);
}

/* 快进 */
function fastForward() {
  offsetMs += 3600e3;
  step(60, false);
  save(); render(); if (tab !== 'home') renderPage();
  tickWeather();              // 快进了一小时，天气也该跟着走
  toast('时间快进 1 小时');
}

/* ---------------- 启动 ---------------- */
function offlineCatchUp() {
  const gap = (Date.now() - S.lastTick) / 60000;
  if (S.acc.on && gap > 30) { S.acc.on = false; log('你离开了很久，这次陪伴自动结束了。', ''); }
  if (gap > 3) {
    const m = Math.min(gap, 720);
    step(m, false);
    if (gap > 60) toast(`${S.name}独自待了 ${bondText(gap)}，快看看它`);
  }
  S.lastTick = Date.now();
}
/* ---------------- PWA：离线与安装 ---------------- */
let swReady = false, swFail = '', installPrompt = null;
function pwaInfo() {
  const hasNav = typeof navigator !== 'undefined';
  const online = !hasNav || navigator.onLine !== false;
  const standalone = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = hasNav && navigator.standalone === true;
  return { online, sw: swReady, fail: swFail, canInstall: !!installPrompt, installed: standalone || iosStandalone };
}
function initPWA() {
  // 注册 Service Worker（仅 https / localhost；file:// 打开时会静默跳过）
  try {
    const proto = (typeof location !== 'undefined' && location.protocol) || '';
    const host = (typeof location !== 'undefined' && location.hostname) || '';
    const okProto = proto === 'https:' || host === 'localhost' || host === '127.0.0.1';
    if ('serviceWorker' in navigator && okProto) {
      navigator.serviceWorker.register('sw.js')
        .then(() => { swReady = true; if (tab === 'me') renderPage(); })
        .catch(e => { swFail = (e && e.message) || '注册失败'; });
    } else if (typeof navigator !== 'undefined') {
      swFail = '需要 https 或 localhost';
    }
  } catch (e) { swFail = '当前环境不支持'; }
  // 安装到桌面
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); installPrompt = e;
    if (tab === 'me') renderPage();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null; toast('已添加到桌面');
    if (tab === 'me') renderPage();
  });
  // 网络状态变化时提示（离线也能继续玩，天气会退化成模拟气候）
  window.addEventListener('offline', () => toast('网络断开了，天气将使用本地模拟气候'));
  window.addEventListener('online', () => { toast('网络已恢复'); loadWeather(true); });
}
function doInstall() {
  if (installPrompt) {
    installPrompt.prompt();
    installPrompt.userChoice.then(c => {
      if (c && c.outcome === 'accepted') toast('正在添加到桌面…');
      installPrompt = null;
      if (tab === 'me') renderPage();
    }).catch(() => {});
    return;
  }
  const p = pwaInfo();
  if (p.installed) return toast('已经装到桌面啦');
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '');
  openSheet('添加到桌面', `<div class="muted" style="line-height:1.9">
      当前浏览器没有直接弹出安装提示，可以手动添加：<br>
      ${isIOS
      ? '1. 用 Safari 打开本页<br>2. 点底部「分享」按钮<br>3. 选「添加到主屏幕」'
      : '1. 点浏览器右上角菜单<br>2. 选「安装应用」或「添加到主屏幕」'}
    </div>`);
}

function showAuthAndWait() {
  return new Promise((resolve) => {
    const layer = $('#auth'); const card = layer.querySelector('.acard'); layer.classList.remove('hidden');
    card.innerHTML = '<h1>小团·陪伴</h1>'
      + '<div class="atabs"><button data-m="in" class="active">登录</button><button data-m="up">注册</button></div>'
      + '<input id="a-email" placeholder="邮箱">'
      + '<input id="a-pwd" type="password" placeholder="密码">'
      + '<input id="a-nick" placeholder="昵称（注册填）" class="hidden">'
      + '<button id="a-go">登录</button>'
      + '<p id="a-err" class="err"></p>'
      + '<a id="a-local" class="local">暂不登录（仅本机体验）</a>';
    let mode = 'in';
    const tabs = card.querySelectorAll('.atabs button');
    tabs.forEach((b) => b.onclick = () => { mode = b.dataset.m; tabs.forEach((x) => x.classList.toggle('active', x === b)); $('#a-nick').classList.toggle('hidden', mode !== 'up'); $('#a-go').textContent = mode === 'up' ? '注册' : '登录'; });
    $('#a-local').onclick = () => { layer.classList.add('hidden'); resolve(false); };
    $('#a-go').onclick = async () => {
      const email = $('#a-email').value.trim(), pwd = $('#a-pwd').value, nick = $('#a-nick').value.trim();
      $('#a-err').textContent = '';
      if (!email || !pwd) { $('#a-err').textContent = '请填写邮箱和密码'; return; }
      let r;
      if (mode === 'up') {
        r = await Cloud.signUp(email, pwd, nick);
        if (r.error) { if (/already|in use/i.test(r.error.message)) $('#a-err').textContent = '该邮箱已注册，请切换到登录'; else $('#a-err').textContent = r.error.message; return; }
        if (!Cloud.loggedIn) { const s = await Cloud.signIn(email, pwd); if (s.error) { $('#a-err').textContent = '注册成功，请登录：' + s.error.message; return; } }
      } else {
        r = await Cloud.signIn(email, pwd);
        if (r.error) { $('#a-err').textContent = r.error.message; return; }
      }
      layer.classList.add('hidden'); resolve(true);
    };
  });
}
function showBanned() {
  const l = $('#auth'); const c = l.querySelector('.acard'); l.classList.remove('hidden');
  c.innerHTML = '<h1>账号已封禁</h1><p class="err">该账号已被管理员封禁，无法进入。如有疑问请联系客服。</p>';
}
async function init() {
  let had = false;
  if (typeof Cloud !== 'undefined' && Cloud.ready) {
    await Cloud.init();
    if (!Cloud.loggedIn) { await showAuthAndWait(); }
    if (Cloud.loggedIn) {
      if (await Cloud.checkBanned()) { showBanned(); return; }
      await Cloud.ensurePet();
      const remote = await Cloud.pullState();
      if (remote && remote.ver) { S = migrate(Object.assign(defaultState(), remote)); had = true; }
      else { S = defaultState(); await Cloud.pushState(S); }
      Cloud.logEvent('login');
      const ob = $('#btn-out');
      if (ob) { ob.hidden = false; ob.onclick = () => { Cloud.signOut().then(() => location.reload()); }; }
    } else { had = load(); }
  } else { had = load(); }
  if (!S.stat) S.stat = { pet: 0, feed: 0, bath: 0, out: 0, gacha: 0, play: 0, heal: 0, hair: 0, dress: 0, sign: 0 };
  if (!S.ach) S.ach = {};
  if (!S.guide) S.guide = { done: false, step: 0 };
  applyPowerSave();
  if (had) offlineCatchUp(); else S.logs = [];
  renderTabs();
  $('#pet-tap').onclick = () => act('pet');
  $('#sheet-x').onclick = closeSheet;
  $('#sheet-mask').onclick = e => { if (e.target.id === 'sheet-mask') closeSheet(); };
  $('#btn-coin').onclick = () => openRecharge();
  $('#btn-ff').onclick = fastForward;
  $('#wcard').onclick = () => switchTab('out');
  $('#btn-date').onclick = () => switchTab('diary');
  render();
  loadWeather(true);
  if (!S.setup) openSetup();
  setInterval(() => {
    step(1 / 6, true); save();
    // 陪伴中 / 游戏加成中，实时刷新倍率与时长，让成长看得见
    if (S.acc.on || S.boost.until > now()) { renderBond(); renderAcc(); renderStats(); }
    checkRemind();
    tickWeather();          // 30 分钟或跨整点自动更新真实天气
    checkAch();             // 成就达成检查（低频，未解锁才写盘）
  }, 10000);
  setInterval(() => { renderTop(); renderStage(); renderAcc(); renderStats(); }, 60000);
  // 黑屏 / 切后台 / 锁屏 → 结束陪伴
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) endAccByLeave('屏幕黑了（切到后台）');
    else {
      S.lastTick = now(); save(); render();
      tickWeather();          // 回到前台时补一次（息屏期间天气可能已经变了）
      const le = S.acc && S.acc.lastEnd;
      if (le && !le.shown && now() - le.t < 3 * 60e3) {
        le.shown = true; save();
        toast(`${le.reason}，陪伴已结束（本次 ${le.mins} 分钟）`);
      }
    }
  });
  // 关闭 App / 刷新 / 返回桌面
  window.addEventListener('pagehide', () => endAccByLeave('关闭了 App'));
  window.addEventListener('beforeunload', () => endAccByLeave('关闭了 App'));
  initPWA();
}
init();
