// Управление: игрок (клавиатура и сенсорные кнопки) и компьютерные соперники.

const ACTIONS = ['left', 'right', 'jump', 'punch', 'kick', 'block', 'sup'];
const Keys = Object.fromEntries(ACTIONS.map((a) => [a, false]));
// Короткое нажатие может начаться и закончиться между кадрами — запоминаем его отдельно.
const Taps = Object.fromEntries(ACTIONS.map((a) => [a, false]));

const PlayerCtrl = {
  read() {
    const out = {};
    for (const a of ACTIONS) { out[a] = Keys[a] || Taps[a]; Taps[a] = false; }
    return out;
  },
};

function pressAction(a) { if (!Keys[a]) Taps[a] = true; Keys[a] = true; }
function releaseAction(a) { Keys[a] = false; }
function releaseAll() { for (const a of ACTIONS) { Keys[a] = false; Taps[a] = false; } }

class AICtrl {
  constructor(skill) {
    const k = clamp(skill, 1, 5) - 1;
    this.react = [0.36, 0.28, 0.22, 0.17, 0.12][k];
    this.blockP = [0.12, 0.25, 0.38, 0.5, 0.62][k];
    this.aggr = [0.5, 0.6, 0.7, 0.78, 0.86][k];
    this.dodgeP = [0.2, 0.32, 0.45, 0.6, 0.72][k];
    this.supP = [0.35, 0.5, 0.65, 0.8, 0.92][k];
    this.cool = rand(0.2, 0.5);
    this.plan = { left: false, right: false, block: false };
  }

  goodTimeForPower(me, opp, ad) {
    switch (me.power) {
      case 'fireball': case 'freeze': case 'boomerang': return ad > 150;
      case 'lightning': return !opp.out;
      case 'quake': return opp.onGround && ad < 520;
      case 'magnet': return ad > 140;
      case 'dash': return ad > 60 && ad < 330;
      case 'teleport': return true;
      case 'regen': return me.hp / me.maxHp < 0.6;
      default: return ad < 260; // giant, speed, vampire
    }
  }

  read(me, opp, m, dt) {
    this.cool -= dt;
    if (this.cool > 0) return { ...this.plan };
    this.cool = this.react * rand(0.7, 1.3);

    const d = opp.x - me.x, ad = Math.abs(d), dir = sign(d);
    let mv = 0, block = false, act = null, jump = false;

    const proj = m.proj.find((p) => p.owner === opp && !p.hitDone && sign(me.x - p.x) === sign(p.vx) && Math.abs(me.x - p.x) < 260);
    const bolt = m.hazards.find((h) => h.type === 'bolt' && h.owner === opp && !h.done && Math.abs(h.x - me.x) < 60);
    const quake = m.hazards.find((h) => h.type === 'quake' && h.owner === opp && !h.done && sign(me.x - h.x) === h.dir && Math.abs(me.x - h.x) < 230);
    let oppSwing = false;
    if (opp.atk && ad < 115) {
      const A = ATTACKS[opp.atk.type];
      oppSwing = opp.atk.t < A.startup + A.active;
    }
    if (opp.dashT > 0 && ad < 260) oppSwing = true;

    if (quake && Math.random() < this.dodgeP) {
      jump = true;
    } else if (bolt && Math.random() < this.dodgeP) {
      mv = me.x < bolt.x ? -1 : 1;
      if (me.x < WALL_L + 80) mv = 1;
      if (me.x > WALL_R - 80) mv = -1;
      this.cool = 0.4;
    } else if (proj && Math.random() < this.dodgeP) {
      if (Math.random() < 0.5) jump = true; else block = true;
    } else if (oppSwing && Math.random() < this.blockP) {
      block = true;
      this.cool = Math.max(this.cool, 0.3);
    } else if ((opp.stunT > 0 || opp.frozenT > 0) && ad < 90) {
      act = Math.random() < 0.5 ? 'kick' : 'punch';
    } else if (me.canAfford() && Math.random() < this.supP && this.goodTimeForPower(me, opp, ad)) {
      act = 'sup';
    } else if (!me.onGround && ad < 95) {
      act = 'kick';
    } else if (ad < 80 * me.scale) {
      const r = Math.random();
      if (r < this.aggr) act = Math.random() < 0.6 ? 'punch' : 'kick';
      else if (r < this.aggr + 0.15) mv = -dir;
      else if (r < this.aggr + 0.25) { jump = true; mv = -dir; }
    } else {
      mv = dir;
      if (ad > 220 && Math.random() < 0.06) jump = true;
      if (ad < 140 && Math.random() < 0.2 * this.aggr) jump = true;
      if (Math.random() > this.aggr + 0.15) mv = 0; // иногда выжидает
    }

    this.plan = { left: mv < 0, right: mv > 0, block };
    return { ...this.plan, jump, punch: act === 'punch', kick: act === 'kick', sup: act === 'sup' };
  }
}
