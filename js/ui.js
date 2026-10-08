// Экраны, создание бойца, ввод, сохранение и главный цикл.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const SAVE_KEY = 'boi-v-kletku-v1';

const App = {
  draft: { name: 'Палыч', hue: 178, acc: 'cap', stats: { str: 4, spd: 4, hp: 5 }, power: 'fireball', diff: 'normal' },
  cup: null,
  match: null,
  screen: 'create',
  portraits: [],
  pvPose: POSES.idle(0),
};

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ draft: App.draft, cup: App.cup })); } catch (e) { /* хранилище недоступно */ }
}
function restore(data) {
  let s = data && (data.draft || data.cup) ? data : null;
  if (!s) { try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { s = null; } }
  if (!s) return;
  if (s.draft && s.draft.stats && POWERS[s.draft.power]) App.draft = { ...App.draft, ...s.draft };
  if (s.cup && s.cup.fighters && s.cup.fighters.length === 10) App.cup = s.cup;
}

function show(name) {
  App.screen = name;
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== `scr-${name}`;
  document.body.classList.toggle('fighting', name === 'fight');
  if (name !== 'fight') releaseAll();
}

// ——— Создание бойца ———
const usedPoints = () => Object.values(App.draft.stats).reduce((a, b) => a + b, 0) - STAT_BASE * 3;

function playerDef() {
  const d = App.draft;
  return { id: 'player', name: d.name.trim() || 'Безымянный', hue: d.hue, acc: d.acc, power: d.power, stats: { ...d.stats } };
}

function pressedBtn(el, on) { el.setAttribute('aria-pressed', on ? 'true' : 'false'); }

function buildCreate() {
  const d = App.draft;
  const name = $('#in-name');
  name.value = d.name;
  name.oninput = () => { d.name = name.value.slice(0, 14); refreshCreate(); save(); };

  $('#swatches').innerHTML = HUES.map((h) =>
    `<button type="button" class="swatch" style="--h:${h.hue}" data-hue="${h.hue}" aria-label="${h.name}"></button>`).join('');
  $('#accs').innerHTML = Object.entries(ACCESSORIES).map(([k, v]) =>
    `<button type="button" class="chip" data-acc="${k}">${v}</button>`).join('');
  $('#stats').innerHTML = Object.entries(STAT_INFO).map(([k, v]) => `
    <div class="stat" data-stat="${k}">
      <div class="stat-name"><b>${v.name}</b><span>${v.hint}</span></div>
      <button type="button" data-d="-1" aria-label="${v.name}: меньше">−</button>
      <div class="pips" aria-hidden="true">${'<span class="pip"></span>'.repeat(STAT_MAX)}</div>
      <button type="button" data-d="1" aria-label="${v.name}: больше">+</button>
    </div>`).join('');
  $('#powers').innerHTML = POWER_IDS.map((id) => {
    const p = POWERS[id];
    return `<button type="button" class="power" data-power="${id}">
      <span class="power-name">${p.name}</span>
      <span class="power-cost">энергия: ${p.cost} из 100</span>
      <span class="power-desc">${p.desc}</span>
    </button>`;
  }).join('');
  $('#diffs').innerHTML = Object.entries(DIFFICULTY).map(([k, v]) =>
    `<button type="button" class="chip" data-diff="${k}">${v.name}</button>`).join('');

  $('#swatches').onclick = (e) => { const b = e.target.closest('[data-hue]'); if (b) { d.hue = +b.dataset.hue; refreshCreate(); save(); } };
  $('#accs').onclick = (e) => { const b = e.target.closest('[data-acc]'); if (b) { d.acc = b.dataset.acc; refreshCreate(); save(); } };
  $('#powers').onclick = (e) => { const b = e.target.closest('[data-power]'); if (b) { d.power = b.dataset.power; refreshCreate(); save(); } };
  $('#diffs').onclick = (e) => { const b = e.target.closest('[data-diff]'); if (b) { d.diff = b.dataset.diff; refreshCreate(); save(); } };
  $('#stats').onclick = (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b) return;
    const k = b.closest('[data-stat]').dataset.stat, delta = +b.dataset.d;
    const nv = d.stats[k] + delta;
    if (nv < 1 || nv > STAT_MAX) return;
    if (delta > 0 && usedPoints() >= STAT_FREE) return;
    d.stats[k] = nv;
    refreshCreate();
    save();
  };
  $('#create-form').onsubmit = (e) => {
    e.preventDefault();
    if (!d.name.trim()) d.name = 'Безымянный';
    App.cup = Cup.create(playerDef(), d.diff);
    save();
    renderCup();
    show('cup');
    window.scrollTo(0, 0);
  };
  $('#btn-resume').onclick = () => { renderCup(); show('cup'); window.scrollTo(0, 0); };
  refreshCreate();
}

function refreshCreate() {
  const d = App.draft;
  for (const b of document.querySelectorAll('#swatches [data-hue]')) pressedBtn(b, +b.dataset.hue === d.hue);
  for (const b of document.querySelectorAll('#accs [data-acc]')) pressedBtn(b, b.dataset.acc === d.acc);
  for (const b of document.querySelectorAll('#powers [data-power]')) pressedBtn(b, b.dataset.power === d.power);
  for (const b of document.querySelectorAll('#diffs [data-diff]')) pressedBtn(b, b.dataset.diff === d.diff);
  const free = STAT_FREE - usedPoints();
  for (const row of document.querySelectorAll('#stats [data-stat]')) {
    const v = d.stats[row.dataset.stat];
    row.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('on', i < v));
    row.querySelector('[data-d="-1"]').disabled = v <= 1;
    row.querySelector('[data-d="1"]').disabled = v >= STAT_MAX || free <= 0;
  }
  $('#pts-left').textContent = free > 0 ? `свободных очков: ${free}` : 'все очки распределены';
  $('#pv-name').textContent = d.name.trim() || 'Безымянный';
  $('#pv-power').textContent = `${POWERS[d.power].name} · здоровье ${statMaxHp(d.stats)}`;
  const c = App.cup;
  const res = $('#resume');
  res.hidden = !(c && c.stage !== 'done');
  if (!res.hidden) {
    const stage = c.stage === 'groups' ? `тур ${c.round + 1} из 9` : c.stage === 'semis' ? 'полуфинал' : 'финал';
    $('#resume-info').textContent = `${c.fighters[0].name}, ${stage}`;
  }
}

function previewPose(t) {
  const k = t % 6;
  if (k > 2.6 && k < 3.1) return POSES.punch(Math.sin(((k - 2.6) / 0.5) * Math.PI));
  if (k > 3.8 && k < 4.4) return POSES.kick(Math.sin(((k - 3.8) / 0.6) * Math.PI));
  if (k > 5 && k < 5.8) return POSES.cast();
  return POSES.idle(t);
}

// ——— Турнир ———
function pipsHtml(v) {
  return `<span class="pips">${Array.from({ length: STAT_MAX }, (_, i) => `<span class="pip${i < v ? ' on' : ''}"></span>`).join('')}</span>`;
}
function dotHtml(f) { return `<span class="dot" style="--h:${f.hue};--sat:${f.sat ?? 1}"></span>`; }

function renderCup() {
  const c = App.cup;
  const F = c.fighters;
  const pm = Cup.playerMatch(c);
  App.portraits = [];

  const titles = { groups: `Тур ${c.round + 1} из 9`, semis: 'Полуфинал', final: 'Финал', done: 'Итоги турнира' };
  const subs = {
    groups: 'Групповой этап: каждый играет с каждым по одному бою.',
    semis: 'Четыре лучших бойца группы. Проигравший выбывает.',
    final: 'Последний бой турнира.',
    done: `Сложность: ${DIFFICULTY[c.diff].name.toLowerCase()}.`,
  };
  $('#cup-title').textContent = titles[c.stage];
  $('#cup-sub').textContent = subs[c.stage];

  // Итог последнего боя игрока
  let note = '';
  if (c.last) {
    const opp = F[c.last.opp];
    const head = c.last.won ? 'Победа!' : 'Поражение';
    const tail = c.last.won
      ? `Соперник: ${esc(opp.name)}. У тебя осталось ${c.last.margin}% здоровья.`
      : `Соперник: ${esc(opp.name)}. У соперника осталось ${c.last.margin}% здоровья.`;
    let extra = '';
    if (c.last.stage === 'groups' && c.stage !== 'groups') {
      extra = c.top4 && c.top4.includes(0) ? ' Групповой этап позади — ты в плей-офф!' : ' Групповой этап окончен, в четвёрку лучших пробиться не удалось.';
    }
    note = `<p class="note">${head}</p><p class="note-sub">${tail}${extra}</p>`;
  }
  $('#cup-note').innerHTML = note;

  // Главная карточка
  let main = '';
  if (pm) {
    const opp = F[pm.opp];
    main = `<div class="card">
      <h3>Следующий бой</h3>
      <div class="vs"><canvas data-fi="0" data-facing="1"></canvas><span class="vs-word">против</span><canvas data-fi="${pm.opp}" data-facing="-1"></canvas></div>
      <div class="vs-names"><span style="color:hsl(${F[0].hue} var(--fig-s) var(--fig-l))">${esc(F[0].name)}</span><span>${esc(opp.name)}</span></div>
      <div class="opp-info">
        <div class="motto">«${esc(opp.motto)}»</div>
        <div class="opp-power"><b>${POWERS[opp.power].name}</b> — ${POWERS[opp.power].desc}</div>
        <div class="mini-stats">${Object.entries(STAT_INFO).map(([k, v]) => `<span>${v.name}${pipsHtml(opp.stats[k])}</span>`).join('')}</div>
      </div>
      <div><button class="btn btn-main" id="btn-fight" type="button">В бой!</button></div>
    </div>`;
  } else if (c.stage === 'done') {
    const place = Cup.playerPlace(c);
    const champ = F[c.champion];
    const lines = {
      1: 'Чемпион турнира — ты! Все девять соперников остались позади.',
      2: 'Второе место: финал проигран, но серебро твоё.',
      3: 'Полуфинал: третье-четвёртое место.',
    };
    const placeText = lines[place] || `Твоё место по итогам группы: ${place} из 10.`;
    main = `<div class="card champ">
      <h3>Чемпион: ${esc(champ.name)}</h3>
      <canvas data-fi="${c.champion}" data-facing="1" data-win="1"></canvas>
      <p>${placeText}</p>
      <div class="cup-foot">
        <button class="btn btn-main" id="btn-again" type="button">Ещё турнир этим бойцом</button>
        <button class="btn" id="btn-new" type="button">Новый боец</button>
      </div>
    </div>`;
  }
  $('#cup-main').innerHTML = main;

  // Таблица
  const rows = Cup.standings(c);
  $('#table').innerHTML = `<thead><tr><th class="num">#</th><th>Боец</th><th class="col-power">Суперсила</th><th class="num">В</th><th class="num">П</th><th class="num">Очки</th><th class="num">±</th></tr></thead>
    <tbody>${rows.map((r, i) => {
      const f = F[r.idx];
      const cls = [r.idx === 0 ? 'me' : '', i === 3 ? 'cut' : ''].join(' ').trim();
      return `<tr class="${cls}"><td class="num">${i + 1}</td><td><span class="fname">${dotHtml(f)}${esc(f.name)}${r.idx === 0 ? ' (ты)' : ''}</span></td>
        <td class="col-power">${POWERS[f.power].name}</td><td class="num">${r.w}</td><td class="num">${r.l}</td><td class="num"><b>${r.pts}</b></td><td class="num">${r.diff > 0 ? '+' : ''}${r.diff}</td></tr>`;
    }).join('')}</tbody>`;

  // Результаты тура или сетка плей-офф
  let side = '';
  if (c.semis) {
    const game = (pair, stage, extraCls = '') => {
      const r = c.results.find((x) => x.stage === stage && pair.includes(x.a) && pair.includes(x.b));
      const names = pair.map((i) => {
        const cls = r ? (r.winner === i ? 'w' : 'l') : '';
        return `<span class="${cls}">${dotHtml(F[i])}${esc(F[i].name)}</span>`;
      });
      return `<div class="game ${extraCls}"><small>${stage === 'final' ? 'Финал' : 'Полуфинал'}</small>${names.join('')}</div>`;
    };
    side = `<h3 style="margin-top:14px">Плей-офф</h3><div class="bracket">${game(c.semis[0], 'semis')}${game(c.semis[1], 'semis')}${c.final ? game(c.final, 'final', 'final') : '<div class="game final"><small>Финал</small><span>ждёт победителей полуфиналов</span></div>'}</div>`;
  } else if (c.round > 0) {
    const res = Cup.roundResults(c, c.round - 1);
    side = `<h3 style="margin-top:14px">Тур ${c.round}: результаты</h3><p class="table-note">Первым записан победитель, проигравший зачёркнут.</p><ul class="results">${res.map((r) => {
      const lose = r.winner === r.a ? r.b : r.a;
      return `<li><b>${dotHtml(F[r.winner])}${esc(F[r.winner].name)}</b> — <s>${esc(F[lose].name)}</s> <span class="soft">· у победителя ${r.margin}% здоровья</span></li>`;
    }).join('')}</ul>`;
  }
  $('#cup-side').innerHTML = side;

  for (const cv of document.querySelectorAll('#scr-cup canvas[data-fi]')) {
    App.portraits.push({ cv, def: F[+cv.dataset.fi], facing: +cv.dataset.facing, win: !!cv.dataset.win });
  }
  const bf = $('#btn-fight'); if (bf) bf.onclick = startFight;
  const ba = $('#btn-again');
  if (ba) ba.onclick = () => { App.cup = Cup.create(playerDef(), App.draft.diff); save(); renderCup(); window.scrollTo(0, 0); };
  const bn = $('#btn-new'); if (bn) bn.onclick = () => { App.cup = null; save(); refreshCreate(); show('create'); window.scrollTo(0, 0); };
  $('#btn-restart').hidden = c.stage === 'done';
}

let restartArmed = false;
$('#btn-restart').onclick = (e) => {
  if (!restartArmed) {
    restartArmed = true;
    e.target.textContent = 'Точно? Нажми ещё раз — турнир пропадёт';
    setTimeout(() => { restartArmed = false; e.target.textContent = 'Бросить турнир и создать нового бойца'; }, 4000);
    return;
  }
  restartArmed = false;
  e.target.textContent = 'Бросить турнир и создать нового бойца';
  App.cup = null;
  save();
  refreshCreate();
  show('create');
};

// ——— Бой ———
function startFight() {
  const c = App.cup;
  const pm = Cup.playerMatch(c);
  if (!pm) return;
  let opp = c.fighters[pm.opp];
  // Если цвета почти совпадают, соперник выходит в «гостевом» цвете.
  const me = c.fighters[0];
  const hueGap = Math.abs(((opp.hue - me.hue + 540) % 360) - 180);
  if (hueGap < 40 && (opp.sat ?? 1) > 0.5) opp = { ...opp, hue: (me.hue + 160) % 360 };
  releaseAll();
  setPaused(false);
  App.match = new Match({
    a: c.fighters[0], b: opp, ctrlA: PlayerCtrl, ctrlB: new AICtrl(opp.skill), label: pm.label,
    onEnd: finishFight,
  });
  show('fight');
  window.scrollTo(0, 0);
  if (document.activeElement) document.activeElement.blur();
}

function finishFight(res) {
  const won = res.winner === 0;
  Cup.recordPlayer(App.cup, won, Math.round(res.hp[res.winner] * 100));
  App.match = null;
  setPaused(false);
  save();
  renderCup();
  show('cup');
  window.scrollTo(0, 0);
}

function setPaused(p) {
  if (App.match) App.match.paused = p;
  $('#pause-menu').hidden = !p;
  if (p) releaseAll();
}
$('#btn-pause').onclick = () => App.match && setPaused(!App.match.paused);
$('#btn-continue').onclick = () => setPaused(false);
$('#btn-giveup').onclick = () => { if (App.match) { setPaused(false); App.match.forfeit(0); } };

const KEYMAP = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'jump', ArrowUp: 'jump',
  KeyJ: 'punch', KeyZ: 'punch', KeyK: 'kick', KeyX: 'kick',
  KeyL: 'block', KeyC: 'block', KeyS: 'block', ArrowDown: 'block',
  Space: 'sup', KeyV: 'sup', KeyI: 'sup',
};
window.addEventListener('keydown', (e) => {
  if (App.screen !== 'fight' || !App.match) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); setPaused(!App.match.paused); return; }
  const a = KEYMAP[e.code];
  if (!a) return;
  e.preventDefault();
  if (!e.repeat && !App.match.paused) pressAction(a);
});
window.addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) releaseAction(a); });
window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && App.match && App.match.phase !== 'end') setPaused(true);
});

for (const b of document.querySelectorAll('#pad [data-act]')) {
  const a = b.dataset.act;
  const up = () => { releaseAction(a); b.classList.remove('down'); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (App.match && App.match.paused) return;
    pressAction(a);
    b.classList.add('down');
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
  });
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}

function sizeCanvas(cv, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
}

// ——— Главный цикл ———
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - lastT) / 1000);
  lastT = now;
  const t = now / 1000;
  if (App.screen === 'fight' && App.match) {
    const cv = $('#arena');
    const w = cv.clientWidth;
    sizeCanvas(cv, w, (w * 9) / 16);
    App.match.update(dt);
    const ctx = cv.getContext('2d');
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    if (App.match) App.match.draw(ctx);
  } else if (App.screen === 'create') {
    App.pvPose = lerpPose(App.pvPose, previewPose(t), 1 - Math.exp(-dt * 18));
    drawPortrait($('#pv'), playerDef(), t, { pose: () => App.pvPose, scale: 1.05 });
  } else if (App.screen === 'cup') {
    for (const p of App.portraits) {
      drawPortrait(p.cv, p.def, t + p.def.hue, { facing: p.facing, pose: p.win ? POSES.win : POSES.idle });
    }
  }
  requestAnimationFrame(frame);
}

function start(data) {
  readTheme();
  restore(data);
  buildCreate();
  if (App.cup && App.cup.stage !== 'done') { renderCup(); show('cup'); }
  else show('create');
  window.claude?.hot?.snapshot?.(() => ({ draft: App.draft, cup: App.cup }));
  requestAnimationFrame(frame);
}

// Сенсорные кнопки: включаем на любом устройстве с касанием, а не только по (pointer: coarse),
// который встроенные браузеры приложений иногда не сообщают.
function enableTouch() { document.body.classList.add('touch'); }
if (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || 'ontouchstart' in window) enableTouch();
window.addEventListener('touchstart', enableTouch, { once: true, passive: true });

matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', readTheme);
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });

window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
