// Данные игры: размеры арены, суперсилы, соперники, внешний вид.

const W = 960, H = 540;
const GROUND = 462;
const WALL_L = 48, WALL_R = 912;

const POWERS = {
  fireball:  { name: 'Огненный шар', cost: 30, desc: 'Шар огня летит через всю арену. 20 урона.' },
  freeze:    { name: 'Заморозка',    cost: 40, desc: 'Ледяной снаряд: 6 урона, соперник замерзает на 1,8 с.' },
  boomerang: { name: 'Бумеранг',     cost: 30, desc: 'Летит вперёд и возвращается. Может попасть дважды.' },
  teleport:  { name: 'Телепорт',     cost: 55, desc: 'Исчезает и бьёт соперника со спины. 10 урона, блоком не закрыться.' },
  lightning: { name: 'Молния',       cost: 50, desc: 'Через полсекунды бьёт туда, где стоит соперник. 26 урона.' },
  giant:     { name: 'Гигант',       cost: 65, desc: 'На 4,5 с вырастает в полтора раза: бьёт сильнее и почти не отлетает.' },
  speed:     { name: 'Скорость',     cost: 50, desc: 'На 6 с бегает и бьёт почти вдвое быстрее.' },
  vampire:   { name: 'Вампиризм',    cost: 50, desc: 'На 7 с каждый удар лечит на 80% от нанесённого урона.' },
  quake:     { name: 'Землетрясение', cost: 70, desc: 'Волна по земле: 12 урона и оглушение. Уйти можно только прыжком.' },
  magnet:    { name: 'Магнит',       cost: 45, desc: 'Притягивает соперника вплотную и оглушает на 0,9 с.' },
  regen:     { name: 'Регенерация',  cost: 55, desc: 'Восстанавливает 26 здоровья за 1,6 секунды.' },
  dash:      { name: 'Рывок',        cost: 45, desc: 'Молниеносный рывок сквозь удары. 14 урона.' },
};
const POWER_IDS = Object.keys(POWERS);

const ACCESSORIES = {
  none: 'Ничего', cap: 'Кепка', crown: 'Корона', band: 'Повязка',
  horns: 'Рожки', tophat: 'Цилиндр', bow: 'Бантик', mohawk: 'Ирокез',
};

const HUES = [
  { hue: 4, name: 'Красный' }, { hue: 26, name: 'Оранжевый' }, { hue: 46, name: 'Жёлтый' },
  { hue: 135, name: 'Зелёный' }, { hue: 178, name: 'Бирюзовый' }, { hue: 222, name: 'Синий' },
  { hue: 270, name: 'Фиолетовый' }, { hue: 325, name: 'Розовый' },
];

// Девять соперников, от слабого к сильному. Все из пенала.
const ROSTER = [
  { id: 'melok',     name: 'Мелок',     hue: 190, acc: 'none',   power: 'freeze',    skill: 1, stats: { str: 3, spd: 3, hp: 6 }, motto: 'Холодный, как доска в январе.' },
  { id: 'knopka',    name: 'Кнопка',    hue: 135, acc: 'cap',    power: 'quake',     skill: 1, stats: { str: 5, spd: 2, hp: 5 }, motto: 'Вдавлю тебя в пол по самую шляпку.' },
  { id: 'lineyka',   name: 'Линейка',   hue: 46,  acc: 'band',   power: 'boomerang', skill: 2, stats: { str: 3, spd: 5, hp: 4 }, motto: 'Всё ровно, всё по сантиметрам.' },
  { id: 'flomaster', name: 'Фломастер', hue: 4,   acc: 'mohawk', power: 'fireball',  skill: 2, stats: { str: 5, spd: 4, hp: 3 }, motto: 'Мой след не отстирается.' },
  { id: 'skrepka',   name: 'Скрепка',   hue: 210, sat: 0.12, acc: 'none', power: 'magnet', skill: 3, stats: { str: 4, spd: 4, hp: 4 }, motto: 'Иди сюда. Ближе.' },
  { id: 'lastik',    name: 'Ластик',    hue: 325, acc: 'bow',    power: 'teleport',  skill: 3, stats: { str: 3, spd: 5, hp: 4 }, motto: 'Был — и нету.' },
  { id: 'tsirkul',   name: 'Циркуль',   hue: 26,  acc: 'tophat', power: 'dash',      skill: 3, stats: { str: 5, spd: 5, hp: 2 }, motto: 'Острый вопрос требует острого ответа.' },
  { id: 'klyaksa',   name: 'Клякса',    hue: 270, acc: 'horns',  power: 'vampire',   skill: 4, stats: { str: 4, spd: 4, hp: 5 }, motto: 'Растекусь по всей твоей тетради.' },
  { id: 'karandash', name: 'Карандаш',  hue: 222, acc: 'crown',  power: 'lightning', skill: 5, stats: { str: 5, spd: 5, hp: 5 }, motto: 'Эту арену нарисовал я.' },
];

const STAT_INFO = {
  str: { name: 'Сила',     hint: 'урон ударов и суперсилы' },
  spd: { name: 'Скорость', hint: 'скорость бега' },
  hp:  { name: 'Здоровье', hint: 'запас здоровья' },
};
const STAT_BASE = 3, STAT_MAX = 7, STAT_FREE = 4;

const DIFFICULTY = {
  easy:   { name: 'Лёгкая',  shift: -1 },
  normal: { name: 'Обычная', shift: 0 },
  hard:   { name: 'Сложная', shift: 1 },
};

// Характеристики → игровые числа
const statMaxHp  = (s) => 70 + 8 * s.hp;
const statDmgMul = (s) => 0.75 + 0.07 * s.str;
const statSpeed  = (s) => 210 + 18 * s.spd;

// Мелкие помощники
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sign = (v) => (v < 0 ? -1 : 1);

// Цвета берутся из CSS-токенов, чтобы холст совпадал с темой страницы.
const Theme = { paper: '#f6f8fb', grid: '#cddbea', ink: '#22336e', inkSoft: '#5d6a8c', margin: '#d65a54', hi: '#ffe45c', onHi: '#22336e', card: '#ffffff', figL: 40, figS: 70 };

function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  Theme.paper = v('--paper') || Theme.paper;
  Theme.grid = v('--grid') || Theme.grid;
  Theme.ink = v('--ink') || Theme.ink;
  Theme.inkSoft = v('--ink-soft') || Theme.inkSoft;
  Theme.margin = v('--margin') || Theme.margin;
  Theme.hi = v('--hi') || Theme.hi;
  Theme.card = v('--card') || Theme.card;
  Theme.onHi = v('--on-hi') || Theme.onHi;
  Theme.figL = parseFloat(v('--fig-l')) || Theme.figL;
  Theme.figS = parseFloat(v('--fig-s')) || Theme.figS;
}

function figColor(def, alpha = 1) {
  const s = Theme.figS * (def.sat ?? 1);
  return `hsla(${def.hue}, ${s}%, ${Theme.figL}%, ${alpha})`;
}

function hueColor(hue, alpha = 1, satMul = 1) {
  return `hsla(${hue}, ${Theme.figS * satMul}%, ${Theme.figL}%, ${alpha})`;
}

const FONT_HAND = '"Caveat", "Segoe Print", "Comic Sans MS", cursive';
const FONT_UI = '"Rubik", "Segoe UI", system-ui, sans-serif';
