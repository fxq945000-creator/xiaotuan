/* ============================================================
 *  小团 · 陪伴  —— 静态数据表
 *  纯数据（食物/城市/衣服/校历/关卡等），不含逻辑，便于单独维护
 * ============================================================ */
const GRADE_SYS = [
  { key: 'baby',  name: '宝宝期', years: 1, mpy: 30, go: '08:40', off: '15:00',
    desc: '还在学走路，需要你多陪陪', course: ['绘本时间', '爬行练习', '午睡', '喝奶'] },
  { key: 'kindergarten', name: '幼儿园', years: 3, mpy: 30, go: '08:30', off: '15:30',
    desc: '小班中班大班，一共三年，放学要接', course: ['手工课', '儿歌课', '点心时间', '午睡', '户外活动'] },
  { key: 'primary', name: '小学', years: 6, mpy: 45, go: '08:00', off: '15:30',
    desc: '六年制，开始有作业和考试', course: ['语文', '数学', '英语', '体育', '美术', '班会'] },
  { key: 'junior', name: '初中', years: 3, mpy: 60, go: '07:40', off: '17:00',
    desc: '三年制，课业变重', course: ['语文', '数学', '英语', '物理', '化学', '体育'] },
  { key: 'senior', name: '高中', years: 3, mpy: 60, go: '07:30', off: '17:30',
    desc: '三年制，冲刺升学', course: ['语文', '数学', '英语', '物理', '化学', '生物', '历史'] },
  { key: 'college', name: '大学', years: 4, mpy: 75, go: '09:00', off: '16:00',
    desc: '四年制，自己安排生活', course: ['专业课', '选修课', '实验课', '社团活动'] },
];

const YEAR_LABEL = { kindergarten: ['小班', '中班', '大班'], college: ['大一', '大二', '大三', '大四'] };

const SPRING_FEST = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23] };

const FIXED_HOLIDAYS = [
  { n: '元旦', m: 1, d: 1, days: 1 },
  { n: '清明节', m: 4, d: 4, days: 3 },
  { n: '劳动节', m: 5, d: 1, days: 5 },
  { n: '国庆节', m: 10, d: 1, days: 7 },
];

const MULT_ACC = 2, MULT_GAME = 2.5;

const CITIES = [
  { name: '北京', lat: 39.9042, lon: 116.4074 }, { name: '上海', lat: 31.2304, lon: 121.4737 },
  { name: '广州', lat: 23.1291, lon: 113.2644 }, { name: '深圳', lat: 22.5431, lon: 114.0579 },
  { name: '成都', lat: 30.5728, lon: 104.0668 }, { name: '杭州', lat: 30.2741, lon: 120.1551 },
  { name: '西安', lat: 34.3416, lon: 108.9398 }, { name: '武汉', lat: 30.5928, lon: 114.3055 },
  { name: '哈尔滨', lat: 45.8038, lon: 126.5349 }, { name: '三亚', lat: 18.2528, lon: 109.5119 },
  { name: '拉萨', lat: 29.6520, lon: 91.1721 }, { name: '乌鲁木齐', lat: 43.8256, lon: 87.6168 },
];

const FOODS = {
  breakfast: [
    { n: '热牛奶', h: 12, m: 3, hp: 2, p: 2, d: '暖暖的一杯' },
    { n: '小笼包', h: 26, m: 5, hp: 0, p: 4, d: '一笼六个' },
    { n: '燕麦粥', h: 24, m: 2, hp: 3, p: 3, d: '健康低负担' },
    { n: '煎蛋吐司', h: 28, m: 4, hp: 1, p: 5, d: '西式早餐' },
    { n: '豆浆油条', h: 27, m: 6, hp: -1, p: 4, d: '经典搭配' },
  ],
  lunch: [
    { n: '番茄炒蛋饭', h: 34, m: 4, hp: 2, p: 6, d: '家常味道' },
    { n: '牛肉面', h: 38, m: 6, hp: 1, p: 8, d: '一大碗管饱' },
    { n: '鸡腿饭', h: 40, m: 7, hp: 0, p: 9, d: '有点香' },
    { n: '蔬菜沙拉', h: 20, m: 1, hp: 4, p: 5, d: '轻食' },
    { n: '炸鸡汉堡', h: 42, m: 10, hp: -4, p: 7, d: '快乐但上火', junk: true },
  ],
  dinner: [
    { n: '小米粥', h: 22, m: 3, hp: 3, p: 3, d: '好消化' },
    { n: '三鲜饺子', h: 36, m: 6, hp: 1, p: 7, d: '十五只' },
    { n: '清蒸鱼饭', h: 34, m: 4, hp: 3, p: 9, d: '营养均衡' },
    { n: '小火锅', h: 44, m: 12, hp: -2, p: 12, d: '偶尔放纵' },
    { n: '泡面', h: 30, m: 5, hp: -3, p: 3, d: '夜里偷偷吃', junk: true },
  ],
  snack: [
    { n: '水果拼盘', h: 14, m: 3, hp: 3, p: 4, d: '维C满满' },
    { n: '布丁', h: 12, m: 6, hp: 0, p: 5, d: '甜甜的' },
    { n: '冰淇淋', h: 10, m: 9, hp: -3, p: 6, d: '吃多了会肚子疼', junk: true },
  ],
};

const SLOT_NAME = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '夜宵' };

const PLACES = [
  { id: 'park',  name: '公园散步', min: 20, cost: 0,  mood: 12, know: 2, clean: -10, ic: 'walk' },
  { id: 'mall',  name: '逛商场',   min: 40, cost: 20, mood: 16, know: 1, clean: -5,  ic: 'closet', style: 25 },
  { id: 'lib',   name: '图书馆',   min: 40, cost: 5,  mood: 4,  know: 12, clean: -3, ic: 'book' },
  { id: 'beach', name: '海边玩水', min: 60, cost: 30, mood: 22, know: 1, clean: -30, ic: 'sun' },
];

const WEATHER_TTL = 30 * 60e3;      // 30 分钟

const W_TEXT = { sunny: '晴', cloudy: '多云', overcast: '阴', fog: '有雾', rain: '下雨', snow: '下雪', thunder: '雷阵雨' };

const W_ICON = { sunny: 'sun', cloudy: 'cloud', overcast: 'cloud', fog: 'cloud', rain: 'rain', snow: 'snow', thunder: 'bolt' };

const SICK_INFO = {
  cold:   { name: '感冒',   ic: 'pill', tip: '多喝热水，注意保暖' },
  fever:  { name: '发烧',   ic: 'pill', tip: '需要吃药休息' },
  heat:   { name: '中暑',   ic: 'sun',  tip: '到阴凉处降降温' },
  stomach:{ name: '肠胃不适', ic: 'pill', tip: '少吃垃圾食品' },
};

const TABS = [
  { id: 'home', n: '首页', ic: 'home' },
  { id: 'closet', n: '装扮', ic: 'closet' },
  { id: 'school', n: '学校', ic: 'school' },
  { id: 'out', n: '出门', ic: 'walk' },
  { id: 'diary', n: '日记', ic: 'diary' },
  { id: 'me', n: '我的', ic: 'user' },
];

const GACHA = [
  { id: 'c10', n: '10 星星币', e: '🪙', w: 20, kind: 'coin', v: 10 },
  { id: 'c20', n: '20 星星币', e: '🪙', w: 12, kind: 'coin', v: 20 },
  { id: 'c50', n: '50 星星币', e: '💰', w: 5, kind: 'coin', v: 50 },
  { id: 's1', n: '小鱼干', e: '🐟', w: 16, kind: 'snack', mood: 7, hunger: 6 },
  { id: 's2', n: '草莓蛋糕', e: '🍰', w: 12, kind: 'snack', mood: 11, hunger: 8 },
  { id: 's3', n: '热牛奶', e: '🥛', w: 10, kind: 'snack', mood: 5, hunger: 10 },
  { id: 't1', n: '橡胶小鸭', e: '🦆', w: 9, kind: 'toy' },
  { id: 't2', n: '毛线球', e: '🧶', w: 7, kind: 'toy' },
  { id: 't3', n: '积木套装', e: '🧱', w: 5, kind: 'toy' },
  { id: 't4', n: '八音盒', e: '🎵', w: 4, kind: 'toy' },
  { id: 't5', n: '星星魔杖', e: '⭐', w: 2, kind: 'toy' },
];

const GACHA_TOYS = GACHA.filter(g => g.kind === 'toy');

const GACHA_ONE = 30, GACHA_TEN = 260;

const ACH = [
  // 陪伴
  { gp: '陪伴', ic: 'heart', id: 'first', n: '初次见面', d: '领养小团，开始一起生活', rw: 20, goal: 1,
    cond: s => !!s.setup, prog: s => (s.setup ? 1 : 0) },
  { gp: '陪伴', ic: 'clock', id: 'bond1h', n: '一小时陪伴', d: '累计陪伴满 1 小时', rw: 10, goal: 60,
    cond: s => s.bond >= 60, prog: s => Math.min(s.bond, 60) },
  { gp: '陪伴', ic: 'clock', id: 'bond10h', n: '形影不离', d: '累计陪伴满 10 小时', rw: 30, goal: 600,
    cond: s => s.bond >= 600, prog: s => Math.min(s.bond, 600) },
  { gp: '陪伴', ic: 'clock', id: 'bond1d', n: '整天在一起', d: '累计陪伴满 24 小时', rw: 80, goal: 1440,
    cond: s => s.bond >= 1440, prog: s => Math.min(s.bond, 1440) },
  // 生活
  { gp: '生活', ic: 'heart', id: 'pet20', n: '摸头爱好者', d: '摸小团的头 20 次', rw: 10, goal: 20,
    cond: s => (s.stat.pet || 0) >= 20, prog: s => Math.min(s.stat.pet || 0, 20) },
  { gp: '生活', ic: 'heart', id: 'pet100', n: '摸头成瘾', d: '摸小团的头 100 次', rw: 30, goal: 100,
    cond: s => (s.stat.pet || 0) >= 100, prog: s => Math.min(s.stat.pet || 0, 100) },
  { gp: '生活', ic: 'feed', id: 'feed30', n: '投喂达人', d: '喂小团吃饭 30 次', rw: 15, goal: 30,
    cond: s => (s.stat.feed || 0) >= 30, prog: s => Math.min(s.stat.feed || 0, 30) },
  { gp: '生活', ic: 'bath', id: 'bath10', n: '香喷喷', d: '给小团洗澡 10 次', rw: 15, goal: 10,
    cond: s => (s.stat.bath || 0) >= 10, prog: s => Math.min(s.stat.bath || 0, 10) },
  { gp: '生活', ic: 'walk', id: 'out10', n: '出门走走', d: '带小团出门 10 次', rw: 20, goal: 10,
    cond: s => (s.stat.out || 0) >= 10, prog: s => Math.min(s.stat.out || 0, 10) },
  { gp: '生活', ic: 'scissors', id: 'hair6', n: '造型常客', d: '去理发店 6 次', rw: 15, goal: 6,
    cond: s => (s.stat.hair || 0) >= 6, prog: s => Math.min(s.stat.hair || 0, 6) },
  { gp: '生活', ic: 'closet', id: 'dress10', n: '衣橱满满', d: '换装扮 10 次', rw: 15, goal: 10,
    cond: s => (s.stat.dress || 0) >= 10, prog: s => Math.min(s.stat.dress || 0, 10) },
  { gp: '生活', ic: 'pill', id: 'heal5', n: '细心照顾', d: '带小团看医生 5 次', rw: 20, goal: 5,
    cond: s => (s.stat.heal || 0) >= 5, prog: s => Math.min(s.stat.heal || 0, 5) },
  // 成长
  { gp: '成长', ic: 'school', id: 'sch10', n: '好好上学', d: '累计上学 10 天', rw: 30, goal: 10,
    cond: s => (s.school.days || 0) >= 10, prog: s => Math.min(s.school.days || 0, 10) },
  { gp: '成长', ic: 'school', id: 'sch50', n: '全勤标兵', d: '累计上学 50 天', rw: 80, goal: 50,
    cond: s => (s.school.days || 0) >= 50, prog: s => Math.min(s.school.days || 0, 50) },
  { gp: '成长', ic: 'book', id: 'primary', n: '戴上红领巾', d: '升入小学', rw: 40, goal: 1,
    cond: s => ['primary', 'junior', 'senior', 'college', 'alumni'].includes(gradeInfo().g.key),
    prog: s => (['primary', 'junior', 'senior', 'college', 'alumni'].includes(gradeInfo().g.key) ? 1 : 0) },
  { gp: '成长', ic: 'star', id: 'alumni', n: '学业有成', d: '读完所有学年，顺利毕业', rw: 200, goal: 1,
    cond: s => gradeInfo().alumni, prog: s => (gradeInfo().alumni ? 1 : 0) },
  // 收集
  { gp: '收集', ic: 'gift', id: 'toys', n: '玩具收藏家', d: '集齐 5 种玩具', rw: 100, goal: GACHA_TOYS.length,
    cond: s => gachaHave() >= GACHA_TOYS.length, prog: s => gachaHave() },
  { gp: '收集', ic: 'gift', id: 'gacha20', n: '扭蛋幸运儿', d: '抽扭蛋 20 次', rw: 30, goal: 20,
    cond: s => (s.gacha || 0) >= 20, prog: s => Math.min(s.gacha || 0, 20) },
  { gp: '收集', ic: 'game', id: 'allgame', n: '玩遍全场', d: '9 个小游戏都玩过', rw: 40, goal: 9,
    cond: s => Object.values(s.games || {}).filter(v => v > 0).length >= 9,
    prog: s => Object.values(s.games || {}).filter(v => v > 0).length },
  { gp: '收集', ic: 'coin', id: 'pay1', n: '第一笔充值', d: '完成一次充值', rw: 50, goal: 1,
    cond: s => (s.pay.total || 0) > 0, prog: s => ((s.pay.total || 0) > 0 ? 1 : 0) },
  { gp: '收集', ic: 'star', id: 'sign7', n: '七日之约', d: '连续签到 7 天', rw: 40, goal: 7,
    cond: s => (s.signin.streak || 0) >= 7, prog: s => Math.min(s.signin.streak || 0, 7) },
];

const GUIDE_STEPS = [
  { ic: 'heart', t: '欢迎来到小团的世界', d: '它会饿、会困、会生病，也会因为你的陪伴慢慢长大。你的任务就是照顾它。' },
  { ic: 'clock', t: '点「开始陪伴」，成长翻倍', d: '默认成长与现实时间同步；点了陪伴按钮后按 2 倍累计，一起玩小游戏是 2.5 倍。离开 App 会自动结束。' },
  { ic: 'feed', t: '按时喂饭、洗澡', d: '下方的快捷按钮可以喂饭、洗澡、哄睡、挠痒痒。属性低了它的心情和健康都会掉。' },
  { ic: 'cloud', t: '天气会让它生病', d: '天气按你所在城市的真实气候获取。天冷穿太薄、下雨没穿雨衣都会感冒发烧，记得看天气卡。' },
  { ic: 'school', t: '陪得越久，年级越高', d: '从幼儿园小班一路读到大学毕业。上学日要按时送它去学校，迟到会被老师批评。' },
  { ic: 'star', t: '星星币与成就', d: '陪它吃饭、上学、玩游戏都能赚币，可以在装扮页买衣服、抽扭蛋。成就页能查看全部目标。' },
];

const OK_WHEN_SLEEP = ['sleep', 'med', 'feed', 'rename', 'cityPick', 'ff', 'autoEnd', 'reset',
  'recharge', 'vip', 'signin', 'setNick', 'orders', 'about', 'me',
  'setNotify', 'setSound', 'setAutoFeed', 'setPower', 'refreshW',
  'ach', 'guide', 'export', 'import', 'install'];

const RECHARGE = [
  { id: 'p6',   rmb: 6,   coins: 60,   bonus: 0,   tag: '' },
  { id: 'p18',  rmb: 18,  coins: 180,  bonus: 20,  tag: '送20' },
  { id: 'p30',  rmb: 30,  coins: 300,  bonus: 45,  tag: '送45' },
  { id: 'p68',  rmb: 68,  coins: 680,  bonus: 150, tag: '热销' },
  { id: 'p128', rmb: 128, coins: 1280, bonus: 320, tag: '送320' },
  { id: 'p328', rmb: 328, coins: 3280, bonus: 980, tag: '超值' },
];

const VIP_PLANS = [
  { id: 'v1',  rmb: 25,  days: 30,  name: '月卡',  desc: '成长加成 +0.3 · 每日签到翻倍' },
  { id: 'v3',  rmb: 68,  days: 90,  name: '季卡',  desc: '成长加成 +0.3 · 每日签到翻倍', tag: '省13元' },
  { id: 'v12', rmb: 238, days: 365, name: '年卡',  desc: '成长加成 +0.3 · 每日签到翻倍', tag: '最划算' },
];

const PAY_WAY = { wx: '微信支付', ali: '支付宝', card: '银行卡' };

const VIP_BONUS = 0.3;

const HIDE_SPOTS = ['🪴', '🧺', '📦', '🛋️', '🪑', '🧸', '🪞', '🚪', '🧦'];

const MIMIC_ACTS = [
  { id: 'clap', e: '👏', n: '拍手' },
  { id: 'jump', e: '🦘', n: '跳跳' },
  { id: 'sleep', e: '😴', n: '睡觉' },
  { id: 'sing', e: '🎵', n: '唱歌' },
];

const MOODS = [
  { id: 'happy', n: '很开心', f: { eyes: 'happy', mouth: 'big', mood: 'happy', blush: true, fx: ['heart'] } },
  { id: 'sleepy', n: '困了', f: { eyes: 'sleep', mouth: 'zzz', mood: 'sleep', fx: ['zzz'] } },
  { id: 'hungry', n: '饿了', f: { eyes: 'sad', mouth: 'wave', mood: 'sad', fx: ['food'] } },
  { id: 'sad', n: '难过', f: { eyes: 'sad', mouth: 'frown', mood: 'sad', fx: [] } },
  { id: 'sick', n: '不舒服', f: { eyes: 'dizzy', mouth: 'wave', mood: 'sick', fx: ['fever'] } },
  { id: 'shy', n: '害羞了', f: { eyes: 'open', mouth: 'o', mood: 'idle', blush: true, fx: [] } },
];
