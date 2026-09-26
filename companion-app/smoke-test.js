/* 运行时冒烟测试（Node + 极简 DOM 桩），不参与线上运行 */
const fs = require('fs');
const vm = require('vm');

function el() {
  const e = {
    innerHTML: '', textContent: '', value: '', hidden: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    querySelectorAll: () => [], querySelector: () => el(), appendChild() {}, remove() {},
    onclick: null, addEventListener() {}, focus() {},
  };
  return e;
}
const cache = {};
const document = {
  hidden: false,
  querySelector: s => (cache[s] = cache[s] || el()),
  createElement: () => el(),
  addEventListener() {},
};
const store = {};
const ctx = {
  document,
  navigator: { geolocation: null },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  fetch: () => Promise.reject(new Error('offline')),
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
  console, Math, Date, JSON, location: { reload() {} },
  addEventListener() {}, removeEventListener() {},
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);

const src = ['data.js', 'pet.js', 'app.js', 'smoke-appendix.js']
  .map(f => fs.readFileSync(f, 'utf8')).join('\n');
vm.runInContext(src, ctx, { filename: 'bundle.js' });

/* ---------- 静态资源 / PWA 检查（与运行时用例合并输出） ---------- */
const checks = [];
const CK = (n, f) => { try { f(); checks.push('PASS  ' + n); } catch (e) { checks.push('FAIL  ' + n + ' :: ' + e.message); } };

CK('manifest.webmanifest 合法且含图标', () => {
  const m = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  if (!m.name || !m.start_url || m.display !== 'standalone') throw new Error('关键字段缺失');
  if (!Array.isArray(m.icons) || m.icons.length < 3) throw new Error('图标不足');
  m.icons.forEach(i => { if (!fs.existsSync(i.src)) throw new Error('图标不存在: ' + i.src); });
});
CK('PWA 图标文件齐全', () => {
  ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'].forEach(f => {
    if (!fs.existsSync(f)) throw new Error('缺少 ' + f);
    const b = fs.readFileSync(f);
    if (b.slice(1, 4).toString() !== 'PNG') throw new Error(f + ' 不是 PNG');
  });
});
CK('sw.js 语法正确且预缓存核心资源', () => {
  new vm.Script(fs.readFileSync('sw.js', 'utf8'));
  const s = fs.readFileSync('sw.js', 'utf8');
  ['./index.html', './styles.css', './data.js', './app.js', './pet.js'].forEach(a => {
    if (!s.includes(a)) throw new Error('未预缓存 ' + a);
  });
});
CK('index.html 引入 manifest 与图标', () => {
  const h = fs.readFileSync('index.html', 'utf8');
  ['manifest.webmanifest', 'apple-touch-icon', 'theme-color'].forEach(k => {
    if (!h.includes(k)) throw new Error('缺少 ' + k);
  });
});
CK('页面无内联事件处理器（CSP 友好）', () => {
  const h = fs.readFileSync('index.html', 'utf8');
  if (/\son(click|load|error)\s*=/.test(h)) throw new Error('存在内联事件');
});
ctx.__static = checks.join('\n');
