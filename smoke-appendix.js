/* 冒烟测试用例（追加在 app.js 之后运行） */
var __out = [];
function T(name, fn) {
  try { fn(); __out.push('PASS  ' + name); }
  catch (e) { __out.push('FAIL  ' + name + ' :: ' + e.message); }
}
function finite() {
  return ['hunger','mood','energy','clean','health','style','bond','coins','knowledge','hairLen']
    .every(k => typeof S[k] === 'number' && isFinite(S[k]));
}

T('初始状态可用', () => { if (!S || !S.name) throw new Error('state missing'); });
T('快进 24 小时', () => { for (let i = 0; i < 24; i++) fastForward(); });
T('数值有限且无毒', () => { if (!finite()) throw new Error('NaN found'); });
T('属性在 0-100', () => {
  ['hunger','mood','energy','clean','health','style'].forEach(k => {
    if (S[k] < 0 || S[k] > 100) throw new Error(k + '=' + S[k]);
  });
});
T('喂食', () => { S.coins = 500; const f = FOODS[mealSlot()][0]; S.sleeping = false; eat(f); if (S.hunger <= 0) throw new Error('hunger 0'); });
T('洗澡', () => { S.atSchool = false; doBath(); if (S.clean !== 100) throw new Error('clean'); });
T('睡觉与叫醒', () => { doSleep(); if (!S.sleeping) throw new Error('not sleeping'); doWake(); if (S.sleeping) throw new Error('still sleeping'); });
T('上学与放学', () => {
  S.sick = null; S.sleeping = false; S.bond = 200;
  goSchool(false); if (!S.atSchool) throw new Error('not at school');
  backFromSchool(); if (S.atSchool) throw new Error('still at school');
  if (!S.school.grades.length) throw new Error('no grade');
});
T('外出与回家', () => {
  const p = PLACES[0]; S.coins = 500; goOut(p);
  if (!S.out) throw new Error('not out');
  S.out.until = now() - 1; backFromOut();
  if (S.out) throw new Error('still out');
});
T('买衣服并穿上', () => { S.coins = 900; S.bond = 3000; buyOrWear('outfit', 'winter'); if (S.outfit !== 'winter') throw new Error('not worn'); });
T('理发店渲染', () => { openSalon(); closeSheet(); });
T('诊所渲染', () => { S.sick = null; openClinic(); closeSheet(); S.sick = { type: 'cold', since: now(), until: now() + 3600e3 }; openClinic(); closeSheet(); S.sick = null; });
T('猜拳', () => { S.sleeping = false; S.atSchool = false; openGame(); closeSheet(); });
T('寒冷天气会生病', () => {
  S.weather = { temp: -6, kind: 'snow', city: '哈尔滨', min: -12, max: -2, hum: 60, wind: 3, live: false };
  S.outfit = 'home'; S.hat = 'none'; S.scarf = false; S.sick = null;
  let hit = false;
  for (let i = 0; i < 60 && !hit; i++) { maybeSick(1); if (S.sick) hit = true; }
  if (!hit) throw new Error('never sick in -6℃');
  S.sick = null;
});
T('保暖穿着不生病', () => {
  S.weather = { temp: -6, kind: 'snow', city: '哈尔滨', live: false };
  S.outfit = 'winter'; S.hat = 'beanie'; S.scarf = true; S.sick = null;
  if (weatherRisk()) throw new Error('should be safe');
});
T('页面渲染：衣橱', () => { tab = 'closet'; renderPage(); if (!$('#page').innerHTML.length) throw new Error('empty'); });
T('页面渲染：学校', () => { tab = 'school'; renderPage(); });
T('页面渲染：出门', () => { tab = 'out'; renderPage(); });
T('页面渲染：日记', () => { tab = 'diary'; renderPage(); });
T('日志有内容', () => { if (!S.logs.length) throw new Error('no logs'); });
T('存档可序列化', () => { save(); const s = JSON.stringify(S); if (!s || s.length < 100) throw new Error('bad save'); });

T('默认倍率 x1（与现实时间一致）', () => { S.acc.on = false; S.boost = { mult: 1, until: 0 }; if (accMult() !== 1) throw new Error('mult=' + accMult()); });
T('开始陪伴 → x2 且状态立即生效', () => {
  startAcc();
  if (!S.acc.on) throw new Error('acc not on');
  if (accMult() !== 2) throw new Error('mult=' + accMult());
  if (Math.floor(S.acc.total) !== 0) throw new Error('session not reset');
});
T('陪伴中成长值双倍累积', () => {
  const before = S.bond; step(10, true);
  const d = S.bond - before;
  if (Math.abs(d - 20) > 0.001) throw new Error('delta=' + d);
  if (Math.abs(S.acc.total - 10) > 0.001) throw new Error('total=' + S.acc.total);
});
T('一起玩游戏 → x2.5（优先级更高）', () => {
  S.boost = { mult: MULT_GAME, until: now() + 600e3 };
  if (accMult() !== 2.5) throw new Error('mult=' + accMult());
  const before = S.bond; step(10, true);
  if (Math.abs((S.bond - before) - 25) > 0.001) throw new Error('delta=' + (S.bond - before));
});
T('加成到期后回落到陪伴倍率', () => { S.boost = { mult: 2.5, until: now() - 1 }; step(1, true); if (accMult() !== 2) throw new Error('mult=' + accMult()); });
T('结束陪伴 → 恢复 x1', () => { stopAcc(); if (S.acc.on) throw new Error('still on'); if (accMult() !== 1) throw new Error('mult=' + accMult()); });
T('陪伴卡渲染', () => { renderAcc(); if (!$('#acccard').innerHTML.length) throw new Error('empty card'); });
T('陪伴时长刷新', () => { renderBond(); if (!$('#bond-val').innerHTML.includes('x')) throw new Error('no mult chip'); });

T('黑屏/关闭 App 自动结束陪伴', () => {
  S.autoEndAcc = true; startAcc(); S.acc.total = 8;
  endAccByLeave('屏幕黑了（切到后台）');
  if (S.acc.on) throw new Error('still on');
  if (accMult() !== 1) throw new Error('mult=' + accMult());
  const last = S.logs[0] || {};
  if (!/自动结束/.test(last.text || '')) throw new Error('no log: ' + last.text);
});
T('开关关闭时离开不结束', () => {
  S.autoEndAcc = false; startAcc();
  endAccByLeave('关闭了 App');
  if (!S.acc.on) throw new Error('should stay on');
  if (accMult() !== 2) throw new Error('mult=' + accMult());
  stopAcc(); S.autoEndAcc = true;
});
T('设置项渲染（我的）', () => { tab = 'me'; renderPage(); if (!$('#page').innerHTML.includes('息屏')) throw new Error('no setting row'); });
T('切换开关', () => { act('autoEnd', '0'); if (S.autoEndAcc !== false) throw new Error('not off'); act('autoEnd', '1'); if (S.autoEndAcc !== true) throw new Error('not on'); });

/* ---- 我的：充值 / 会员 / 签到 / 设置 ---- */
T('我的页渲染', () => {
  tab = 'me'; renderPage();
  const h = $('#page').innerHTML;
  ['我的资产', '充值星星币', '每日签到', '设置', 'VIP'].forEach(k => {
    if (k === 'VIP' && !h.includes('会员')) throw new Error('no vip card');
    else if (k !== 'VIP' && !h.includes(k)) throw new Error('missing ' + k);
  });
});
T('充值档位渲染', () => {
  openRecharge();
  const b = $('#sheet-body').innerHTML;
  if (!b.includes('¥6') || !b.includes('¥328')) throw new Error('plans missing');
  closeSheet();
});
T('首充双倍到账', () => {
  S.pay = { total: 0, orders: [], first: false };
  S.coins = 0;
  finishPay(6, 60 + 60, '60 星星币', 'wx', true);
  if (S.coins !== 120) throw new Error('coins=' + S.coins);
  if (S.pay.total !== 6) throw new Error('total');
  if (S.pay.orders.length !== 1) throw new Error('order');
  if (!S.pay.first) throw new Error('first flag');
});
T('二次充值不再双倍', () => {
  S.coins = 0;
  finishPay(30, 345, '300 星星币', 'ali', false);
  if (S.coins !== 345) throw new Error('coins=' + S.coins);
  if (S.pay.total !== 36) throw new Error('total=' + S.pay.total);
});
T('会员开通与倍率', () => {
  S.vip = { until: 0, bought: 0 };
  const before = accMult();
  if (Math.abs(before - 1) > 1e-6) throw new Error('base mult=' + before);
  S.vip.until = now() + 30 * 864e5;
  if (!vipOn()) throw new Error('vip off');
  const mv = accMult();
  if (Math.abs(mv - 1.3) > 1e-6) throw new Error('vip mult=' + mv);
  S.acc.on = true;
  const ma = accMult();
  if (Math.abs(ma - 2.3) > 1e-6) throw new Error('acc+vip=' + ma);
  S.acc.on = false;
  if (vipDays() !== 30) throw new Error('days=' + vipDays());
});
T('会员套餐弹层', () => {
  S.vip = { until: now() + 864e5, bought: 25 };
  openVip(); if (!$('#sheet-body').innerHTML.includes('月卡')) throw new Error('no plan'); closeSheet();
  S.vip = { until: 0, bought: 0 };
});
T('每日签到', () => {
  S.signin = { last: '', streak: 0 }; S.coins = 0;
  doSignin();
  if (S.coins !== 20) throw new Error('coins=' + S.coins);
  if (S.signin.streak !== 1) throw new Error('streak');
  const before = S.coins;
  doSignin();                                  // 同一天重复签到应无效
  if (S.coins !== before) throw new Error('double signin');
});
T('签到连签递增', () => {
  S.signin = { last: dayKey(now() - 864e5), streak: 3 }; S.coins = 0;
  doSignin();
  if (S.coins !== 35) throw new Error('coins=' + S.coins + ' expect 35');
  if (S.signin.streak !== 4) throw new Error('streak=' + S.signin.streak);
});
T('自动喂食开关', () => {
  S.set.autoFeed = true; S.coins = 100; S.hunger = 10;
  S.sleeping = false; S.atSchool = false; S.out = null;
  step(2, true);
  if (S.hunger <= 10) throw new Error('autoFeed not working, hunger=' + S.hunger);
  S.set.autoFeed = false;
});
T('提醒通知不会刷屏', () => {
  S.set.notify = true; S.remind = {}; S.hunger = 5; S.atSchool = false; S.sleeping = false;
  checkRemind();
  const t1 = S.remind.hunger;
  if (!t1) throw new Error('not reminded');
  checkRemind();
  if (S.remind.hunger !== t1) throw new Error('too frequent');
  S.set.notify = false; S.remind = {};
  checkRemind();
  if (S.remind.hunger) throw new Error('should be muted');
  S.set.notify = true;
});
T('声音与省电开关', () => {
  act('setSound', '0'); if (S.set.sound !== false) throw new Error('sound');
  act('setSound', '1'); if (S.set.sound !== true) throw new Error('sound2');
  act('setPower', '1'); if (S.set.powerSave !== true) throw new Error('power');
  act('setPower', '0'); if (S.set.powerSave !== false) throw new Error('power2');
  act('setAutoFeed', '1'); if (!S.set.autoFeed) throw new Error('feed');
  act('setAutoFeed', '0');
  act('setNotify', '0'); if (S.set.notify !== false) throw new Error('notify');
  act('setNotify', '1');
});
T('充值记录与关于', () => {
  openOrders(); if (!$('#sheet-body').innerHTML.includes('星星币')) throw new Error('no order'); closeSheet();
  openAbout();
  const ab = $('#sheet-body').innerHTML;
  if (!ab.includes('版本') || !ab.includes('存档')) throw new Error('no about');
  closeSheet();
});
T('睡觉时仍可打开设置与充值', () => {
  S.sleeping = true;
  const c = S.coins;
  act('recharge'); closeSheet();
  act('about'); closeSheet();
  if (S.coins !== c) throw new Error('unexpected change');
  S.sleeping = false;
});

T('游戏中心含 5 个游戏', () => {
  S.sleeping = false; S.atSchool = false; openGame();
  const h = $('#sheet-body').innerHTML;
  ['打地鼠', '记忆翻牌', '算术闯关', '接球', '猜拳'].forEach(n => { if (!h.includes(n)) throw new Error('missing ' + n); });
});
T('打地鼠开局', () => { openMole(); if (!$('#sheet-body').innerHTML.includes('moles')) throw new Error('no moles'); clearGame(); });
T('记忆翻牌开局', () => { openMem(); if (!$('#sheet-body').innerHTML.includes('mem')) throw new Error('no mem grid'); clearGame(); });
T('算术闯关开局', () => { openQuiz(); if (!$('#sheet-body').innerHTML.includes('quiz-q')) throw new Error('no quiz'); clearGame(); });
T('接球开局', () => { openCatch(); if (!$('#sheet-body').innerHTML.includes('track')) throw new Error('no track'); clearGame(); });
T('出题合法（含正确答案、3 个选项）', () => {
  for (let lv = 0; lv <= 4; lv++) for (let i = 0; i < 12; i++) {
    const q = makeQ(lv);
    if (q.opts.length !== 3) throw new Error('opts=' + q.opts.length);
    if (!q.opts.includes(q.ans)) throw new Error('ans not in opts: ' + q.q);
  }
});
T('捉迷藏开局', () => {
  S.sleeping = false; S.atSchool = false;
  openHide();
  const h = $('#sheet-body').innerHTML;
  if (!h.includes('hitem') || !$('#sheet-title').textContent.includes('捉迷藏')) throw new Error('hide not rendered');
  closeSheet();
});
T('学动作开局', () => {
  openMimic();
  const h = $('#sheet-body').innerHTML;
  if (!h.includes('mbtn') || !$('#sheet-title').textContent.includes('学动作')) throw new Error('mimic not rendered');
  closeSheet();
});
T('挠痒痒开局', () => {
  openTickle();
  const h = $('#sheet-body').innerHTML;
  if (!h.includes('tick-pet') || !$('#sheet-title').textContent.includes('挠痒痒')) throw new Error('tickle not rendered');
  closeSheet();
});
T('猜心情开局', () => {
  openMood();
  const h = $('#sheet-body').innerHTML;
  if (!h.includes('moodopts') || !$('#sheet-title').textContent.includes('猜心情')) throw new Error('mood not rendered');
  closeSheet();
});
T('游戏中心共 9 个游戏', () => {
  openGame();
  const h = $('#sheet-body').innerHTML;
  const n = (h.match(/data-g="/g) || []).length;
  if (n !== 9) throw new Error('games=' + n);
  ['捉迷藏', '学动作', '挠痒痒', '猜心情'].forEach(k => { if (!h.includes(k)) throw new Error('missing ' + k); });
  closeSheet();
});
T('所有游戏都能从结算页再来一局', () => {
  ['rps', 'mole', 'mem', 'quiz', 'catch', 'hide', 'mimic', 'tickle', 'mood'].forEach(k => {
    if (typeof GAME_FN[k] !== 'function') throw new Error('no fn for ' + k);
  });
});
T('新游戏纪录字段存在', () => {
  ['hide', 'mimic', 'tickle', 'mood'].forEach(k => {
    if (typeof S.games[k] !== 'number') throw new Error('missing games.' + k);
  });
});
T('游戏结算给奖励并触发 x2.5', () => {
  S.boost = { mult: 1, until: 0 };
  const c0 = S.coins, m0 = S.mood;
  finishGame({ name: '测试', coins: 7, mood: 3, txt: 'x' });
  // 结算会触发 checkAch()，解锁成就时可能额外发币，故只断言下界
  if (S.coins < c0 + 7) throw new Error('coins=' + S.coins + ' c0=' + c0);
  if (S.mood <= m0) throw new Error('mood');
  if (accMult() !== 2.5) throw new Error('mult=' + accMult());
  S.boost = { mult: 1, until: 0 };
});

T('学制：幼儿园共 3 年', () => {
  S.bond = 30;
  if (gradeInfo().g.key !== 'kindergarten') throw new Error('not k: ' + gradeInfo().name);
  if (gradeInfo().name !== '幼儿园小班') throw new Error('y1=' + gradeInfo().name);
  S.bond = 75; if (gradeInfo().name !== '幼儿园中班') throw new Error('y2=' + gradeInfo().name);
  S.bond = 115; if (gradeInfo().name !== '幼儿园大班') throw new Error('y3=' + gradeInfo().name);
  S.bond = 120; if (gradeInfo().g.key !== 'primary') throw new Error('should enter primary');
});
T('学制：小学 6 年 / 初中 3 年 / 高中 3 年 / 大学 4 年', () => {
  S.bond = 120; if (gradeInfo().name !== '小学1年级') throw new Error(gradeInfo().name);
  S.bond = 385; if (gradeInfo().name !== '小学6年级') throw new Error(gradeInfo().name);
  S.bond = 390; if (gradeInfo().g.key !== 'junior') throw new Error('junior');
  S.bond = 570; if (gradeInfo().g.key !== 'senior') throw new Error('senior');
  S.bond = 750; if (gradeInfo().g.key !== 'college') throw new Error('college');
  if (gradeInfo().name !== '大一') throw new Error(gradeInfo().name);
  S.bond = 1100; if (!gradeInfo().alumni) throw new Error('should graduate');
  if (canSchool()) throw new Error('alumni should not go to school');
});
T('校历：周末不上学', () => {
  S.bond = 200;
  const sat = new Date(2026, 8, 26);            // 2026-09-26 周六
  if (schoolStatus(sat).open) throw new Error('weekend should rest');
});
T('校历：暑假不上学', () => {
  S.bond = 200;
  if (schoolStatus(new Date(2026, 6, 15)).open) throw new Error('summer vacation');
});
T('校历：国庆不上学', () => {
  S.bond = 200;
  if (schoolStatus(new Date(2026, 9, 2)).open) throw new Error('national day');
});
T('校历：普通工作日上学', () => {
  S.bond = 200;
  const d = new Date(2026, 8, 15);              // 2026-09-15 周二
  if (!schoolStatus(d).open) throw new Error('should open: ' + schoolStatus(d).why);
});
T('校历：能算出下次开学日', () => {
  S.bond = 200;
  const nx = nextOpenDay(new Date(2026, 6, 15));
  if (!nx) throw new Error('no next day');
  if (nx.getMonth() !== 8) throw new Error('should be Sept: ' + nx.toDateString());
});
T('宝宝期不上学', () => {
  S.bond = 5;
  if (canSchool()) throw new Error('baby should not go');
  S.bond = 200;
});

/* ---- 立刻做的 4 项优化 ---- */
T('睡觉时不再饿到虚脱', () => {
  S.sleeping = true; S.atSchool = false; S.hunger = 60; S.energy = 30; S.sick = null;
  step(480, false);                       // 睡 8 小时
  if (S.hunger < 8) throw new Error('hunger=' + S.hunger);
  if (S.energy < 90) throw new Error('energy=' + S.energy);
  if (S.hunger === 0) throw new Error('starved while sleeping');
  S.sleeping = false;
});
T('醒着时饱食照常衰减', () => {
  S.sleeping = false; S.atSchool = false; S.hunger = 100;
  step(60, false);
  if (S.hunger > 76) throw new Error('no decay: ' + S.hunger);
});
T('天气到期判定', () => {
  S.weather = { temp: 20, kind: 'sunny', city: 'x' };
  S.weatherAt = now(); S.weatherHour = new Date(now()).getHours();
  if (weatherDue()) throw new Error('should not be due');
  S.weatherAt = now() - 31 * 60e3;
  if (!weatherDue()) throw new Error('should be due after 31 min');
  S.weatherAt = now(); S.weatherHour = -1;
  if (!weatherDue()) throw new Error('should be due on hour change');
});
T('天气变化会写日记并提醒', () => {
  S.sick = null; S.out = null; S.atSchool = false;
  const before = S.logs.length;
  S.weather = { temp: 26, kind: 'sunny', city: 'x' };
  onWeatherChanged({ temp: 12, kind: 'rain' });
  if (S.logs.length !== before + 1) throw new Error('no log');
  if (!S.logs[0].text.includes('天气变了')) throw new Error('wrong log: ' + S.logs[0].text);
});
T('天气没大变化不打扰', () => {
  const before = S.logs.length;
  S.weather = { temp: 21, kind: 'sunny', city: 'x' };
  onWeatherChanged({ temp: 20, kind: 'sunny' });
  if (S.logs.length !== before) throw new Error('should not log');
});
T('扭蛋会消耗星星币', () => {
  S.coins = 1000; S.toys = {}; S.gacha = 0; S.toyDone = false;
  const list = doGacha(1);
  if (!list || list.length !== 1) throw new Error('no result');
  if (S.coins > 1000 - 30 + 50) throw new Error('coins not spent: ' + S.coins);
  if (S.gacha !== 1) throw new Error('gacha count');
});
T('扭蛋十连更便宜', () => {
  S.coins = 2000;
  const c0 = S.coins;
  const list = doGacha(10);
  if (!list || list.length !== 10) throw new Error('no ten');
  const spent = c0 + 0 - S.coins;
  if (spent > 260) throw new Error('spent too much: ' + spent);
  if (spent < 260 - 50 * 10) throw new Error('weird: ' + spent);
});
T('扭蛋币不够时不开奖', () => {
  S.coins = 5;
  if (doGacha(1) !== null) throw new Error('should refuse');
  if (S.coins !== 5) throw new Error('coins changed');
});
T('集齐玩具有奖励', () => {
  S.coins = 5000; S.toys = {}; S.toyDone = false;
  let guard = 0;
  while (!S.toyDone && guard++ < 4000) doGacha(10);
  if (!S.toyDone) throw new Error('never completed in ' + guard + ' draws');
  if (gachaHave() !== GACHA_TOYS.length) throw new Error('not all toys');
});
T('扭蛋卡片渲染', () => {
  tab = 'closet'; renderPage();
  if (!$('#page').innerHTML.includes('扭蛋机')) throw new Error('no gacha card');
  tab = 'home';
});
T('切换页签记住滚动位置', () => {
  const v = $('.view');
  v.scrollTop = 120;
  switchTab('me');
  if (scrollMemo.home !== 120) throw new Error('not saved: ' + scrollMemo.home);
  v.scrollTop = 40;
  switchTab('home');
  if (v.scrollTop !== 120) throw new Error('not restored: ' + v.scrollTop);
});

/* ---------- 存档版本迁移链 ---------- */
T('迁移：无版本号的老存档升到当前版本', () => {
  const old = { name: '老团', coins: 66, bond: 12 };   // 模拟 v1：没有 ver / acc / boost / vip…
  const s = migrate(Object.assign(defaultState(), old));
  if (s.ver !== SAVE_VER) throw new Error('ver=' + s.ver);
  if (s.name !== '老团' || s.coins !== 66) throw new Error('data lost');
  if (!s.acc || !s.boost || !s.vip || !s.pay || !s.signin || !s.set) throw new Error('missing groups');
  ['rps', 'mole', 'mem', 'quiz', 'catch', 'hide', 'mimic', 'tickle', 'mood']
    .forEach(k => { if (typeof s.games[k] !== 'number') throw new Error('missing game ' + k); });
});
T('迁移：老用户不再弹新手引导', () => {
  const s = migrate(Object.assign(defaultState(), { ver: 2, setup: true, name: 'x' }));
  if (s.ver !== SAVE_VER) throw new Error('ver=' + s.ver);
  if (!s.guide || s.guide.done !== true) throw new Error('guide should be skipped for old save');
});
T('迁移：新存档保留引导且字段完整', () => {
  const s = defaultState();
  if (s.ver !== SAVE_VER) throw new Error('ver');
  if (s.guide.done !== false) throw new Error('guide');
  if (!s.ach || typeof s.ach !== 'object') throw new Error('ach');
  ['pet', 'feed', 'bath', 'out', 'gacha', 'play', 'heal', 'hair', 'dress', 'sign']
    .forEach(k => { if (typeof s.stat[k] !== 'number') throw new Error('stat missing ' + k); });
});
T('迁移：损坏存档走兜底不抛错', () => {
  const before = S;
  try { JSON.parse('{oops'); } catch (e) {}
  S = defaultState();
  if (!S.name) throw new Error('fallback failed');
  S = before;
});

/* ---------- XSS 转义 ---------- */
T('用户输入被转义', () => {
  const bad = '<img src=x onerror=alert(1)>';
  if (esc(bad).includes('<img')) throw new Error('not escaped');
  if (esc('a&b') !== 'a&amp;b') throw new Error('amp');
  if (esc('"q"') !== '&quot;q&quot;') throw new Error('quote');
});
T('恶意名字不会注入到页面', () => {
  const keep = S.name;
  S.name = '<img src=x onerror=alert(1)>';
  tab = 'me'; renderPage();
  if ($('#page').innerHTML.includes('<img src=x')) throw new Error('raw html leaked');
  S.name = keep; tab = 'home';
});

/* ---------- 成就 ---------- */
T('成就：达成后解锁并发币', () => {
  S.ach = {}; S.setup = true;
  const c0 = S.coins;
  if (!checkAch()) throw new Error('should unlock');
  if (!S.ach.first) throw new Error('first not unlocked');
  if (S.coins <= c0) throw new Error('no reward');
  if (achCount() < 1) throw new Error('count');
});
T('成就：已解锁不会重复发奖', () => {
  const c0 = S.coins, n0 = achCount();
  checkAch();
  if (S.coins !== c0) throw new Error('rewarded twice');
  if (achCount() !== n0) throw new Error('count changed');
});
T('成就：按统计次数解锁', () => {
  S.stat.pet = 20; checkAch();
  if (!S.ach.pet20) throw new Error('pet20 not unlocked');
  S.stat.pet = 100; checkAch();
  if (!S.ach.pet100) throw new Error('pet100 not unlocked');
});
T('成就：进度计算正确', () => {
  S.stat.bath = 5;
  const a = ACH.find(x => x.id === 'bath10');
  if (a.prog(S) !== 5) throw new Error('prog=' + a.prog(S));
  if (a.cond(S)) throw new Error('should not reach');
});
T('成就页渲染', () => {
  openAch();
  const h = $('#sheet-body').innerHTML;
  if (!h.includes('ach-num') || !h.includes('初次见面')) throw new Error('ach page not rendered');
  closeSheet();
});
T('行为统计会累加', () => {
  const p0 = S.stat.pet || 0;
  stat('pet'); stat('pet', 2);
  if (S.stat.pet !== p0 + 3) throw new Error('stat=' + S.stat.pet);
});

/* ---------- 新手引导 ---------- */
T('新手引导渲染并可推进', () => {
  S.guide = { done: false, step: 0 };
  openGuide(0);
  const h = $('#sheet-body').innerHTML;
  if (!h.includes('guide-t') || !h.includes('欢迎来到小团的世界')) throw new Error('guide not rendered');
  closeSheet(true);
  if (S.guide.done) throw new Error('should not be done at step 0');
});
T('新手引导推进与完成', () => {
  S.guide = { done: false, step: 0 };
  if (guideNext(0) !== false) throw new Error('step0 should not finish');
  if (S.guide.step !== 1 || S.guide.done) throw new Error('step=' + S.guide.step);
  const last = GUIDE_STEPS.length - 1;
  openGuide(last);
  if (!$('#sheet-body').innerHTML.includes('开始照顾')) throw new Error('last button text missing');
  closeSheet(true);
  if (guideNext(last) !== true) throw new Error('last step should finish');
  if (!S.guide.done) throw new Error('not done');
});

/* ---------- 存档导出 / 导入 ---------- */
T('导出存档生成可解析的 JSON', () => {
  exportSave();                       // 面板能正常打开（不抛错）
  if (!$('#sheet-title').textContent.includes('导出')) throw new Error('panel not open');
  closeSheet();
  // 面板里的文本经过 esc()，反转义后应能还原成合法存档
  const unesc = t => t.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
  const obj = JSON.parse(unesc(esc(JSON.stringify(S))));
  if (obj.name !== S.name) throw new Error('name mismatch');
  if (obj.ver !== SAVE_VER) throw new Error('ver');
});

setTimeout(() => {
  T('天气异步获取（离线降级为模拟）', () => { if (!S.weather || !S.weather.kind) throw new Error('no weather'); });
  __results = __out.join('\n') + (typeof __static === 'string' ? '\n' + __static : '');
  console.log(__results);
}, 400);
