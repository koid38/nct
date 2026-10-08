// Боец: движение, удары, блок, суперсилы.

const ATTACKS = {
  punch: { startup: 0.07, active: 0.09, recovery: 0.14, dmg: 6,  range: 64, kb: 140, stun: 0.22, h: 74 },
  kick:  { startup: 0.16, active: 0.10, recovery: 0.24, dmg: 10, range: 82, kb: 330, stun: 0.32, h: 46 },
};
const GRAVITY = 1900, JUMP_V = 660;
const HIT_WORDS = ['БАЦ!', 'БАМ!', 'ХРЯСЬ!', 'ТЫЩ!', 'ПАФ!', 'БУМ!', 'ШМЯК!'];
const THROW_POWERS = ['fireball', 'freeze', 'boomerang'];

class Fighter {
  constructor(def, side) {
    this.def = def;
    this.power = def.power;
    this.maxHp = statMaxHp(def.stats);
    this.hp = this.maxHp;
    this.hpShown = this.hp;
    this.dmgMul = statDmgMul(def.stats);
    this.baseSpeed = statSpeed(def.stats);
    this.x = side < 0 ? 300 : 660;
    this.y = GROUND;
    this.vx = 0; this.vy = 0; this.kbx = 0;
    this.facing = side < 0 ? 1 : -1;
    this.energy = 25;
    this.state = 'fight'; // fight | ko | win | lose
    this.atk = null;
    this.hurtT = 0; this.stunT = 0; this.frozenT = 0; this.castT = 0; this.dashT = 0; this.inv = 0;
    this.castPose = 'cast';
    this.buffs = { giant: 0, speed: 0, vamp: 0 };
    this.regenT = 0;
    this.scale = 1;
    this.t = Math.random() * 10;
    this.pose = POSES.idle(0);
    this.trail = [];
    this.flash = 0;
    this.koT = 0;
    this.pull = null;
    this.dashHit = false;
    this.blocking = false;
    this.input = {};
    this.prevInput = {};
  }

  get onGround() { return this.y >= GROUND - 0.5; }
  get out() { return this.state !== 'fight'; }
  get busy() {
    return this.out || this.hurtT > 0 || this.stunT > 0 || this.frozenT > 0 || !!this.atk ||
      this.castT > 0 || this.dashT > 0 || !!this.pull;
  }
  canAfford() { return this.energy >= POWERS[this.power].cost; }
  speedMul() { return this.buffs.speed > 0 ? 1.7 : 1; }
  heal(v) { this.hp = Math.min(this.maxHp, this.hp + v); }

  update(dt, m, opp) {
    this.t += dt;
    const inp = this.input, prev = this.prevInput;
    const pressed = (k) => inp[k] && !prev[k];

    for (const b in this.buffs) this.buffs[b] = Math.max(0, this.buffs[b] - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.stunT = Math.max(0, this.stunT - dt);
    this.frozenT = Math.max(0, this.frozenT - dt);
    this.castT = Math.max(0, this.castT - dt);
    this.inv = Math.max(0, this.inv - dt);
    this.flash = Math.max(0, this.flash - dt);
    if (this.state === 'ko') this.koT += dt;
    if (this.regenT > 0 && !this.out) {
      const h = Math.min(this.regenT, dt);
      this.regenT -= h;
      this.heal(16.25 * h);
      if (Math.random() < dt * 14) m.plus(this);
    }
    if (!this.out && m.phase === 'fight') this.energy = Math.min(100, this.energy + 6 * dt);
    this.scale = lerp(this.scale, this.buffs.giant > 0 ? 1.45 : 1, 1 - Math.exp(-dt * 8));
    this.hpShown = this.hpShown > this.hp ? Math.max(this.hp, this.hpShown - dt * 30) : this.hp;

    if (this.pull) {
      this.pull.t -= dt;
      this.x = lerp(this.x, this.pull.to, 1 - Math.exp(-dt * 18));
      if (this.pull.t <= 0) this.pull = null;
    }

    if (m.phase === 'fight' && !this.busy) {
      if (this.onGround) this.facing = sign(opp.x - this.x);
      if (pressed('sup') && this.canAfford()) this.usePower(m, opp);
      else if (pressed('punch')) this.atk = { type: 'punch', t: 0, hit: false };
      else if (pressed('kick')) this.atk = { type: 'kick', t: 0, hit: false };
    }

    this.blocking = false;
    if (m.phase === 'fight' && !this.busy) {
      if (inp.block && this.onGround) {
        this.blocking = true;
        this.vx = 0;
      } else {
        const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
        this.vx = dir * this.baseSpeed * this.speedMul();
        if (pressed('jump') && this.onGround) { this.vy = -JUMP_V; m.dust(this.x, 4); }
      }
    } else if (this.dashT > 0) {
      this.vx = this.facing * 1150;
    } else if (this.onGround) {
      this.vx = 0;
    }

    if (this.atk) {
      const a = this.atk, A = ATTACKS[a.type];
      a.t += dt * (this.buffs.speed > 0 ? 1.6 : 1);
      if (!a.hit && a.t >= A.startup && a.t <= A.startup + A.active) this.tryHit(m, opp, A);
      if (a.t >= A.startup + A.active + A.recovery) this.atk = null;
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      if (!this.dashHit && !opp.out && Math.abs(opp.x - this.x) < 48 && Math.abs(opp.y - this.y) < 90) {
        this.dashHit = true;
        opp.takeHit(m, this, 14 * this.dmgMul, this.facing * 480, { stun: 0.35, word: 'ВЖУХ!' });
      }
      if (this.dashT <= 0) this.vx = 0;
    }

    // Физика
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;
    if (this.y >= GROUND) {
      if (this.vy > 500) m.dust(this.x, 5);
      this.y = GROUND;
      this.vy = 0;
    }
    this.x += (this.vx + this.kbx) * dt;
    this.kbx *= Math.exp(-dt * 7);
    if (Math.abs(this.kbx) < 5) this.kbx = 0;
    this.x = clamp(this.x, WALL_L + 14, WALL_R - 14);

    // Шлейф при скорости и рывке
    const moving = Math.abs(this.vx) > 20;
    if (this.dashT > 0 || (this.buffs.speed > 0 && moving)) {
      this.trail.push({ x: this.x, y: this.y, facing: this.facing, pose: this.pose, a: 1 });
    }
    for (const tr of this.trail) tr.a -= dt * 5;
    this.trail = this.trail.filter((tr) => tr.a > 0).slice(-6);

    this.updatePose(dt);
    this.prevInput = { ...inp };
  }

  tryHit(m, opp, A) {
    if (opp.out) return;
    const s = this.scale;
    const dx = (opp.x - this.x) * this.facing;
    const hy = this.y - A.h * s;
    const top = opp.y - 118 * opp.scale - 8;
    if (dx > -12 && dx < A.range * s + 10 && hy > top && hy < opp.y + 8) {
      this.atk.hit = true;
      const dmg = A.dmg * this.dmgMul * (this.buffs.giant > 0 ? 1.35 : 1);
      opp.takeHit(m, this, dmg, this.facing * A.kb, { stun: A.stun, hx: this.x + this.facing * A.range * s * 0.85, hy });
    }
  }

  // Возвращает false, если удар не прошёл, иначе 'hit' или 'blocked'.
  takeHit(m, src, dmg, kb, opts = {}) {
    if (this.out || this.inv > 0) return false;
    let blocked = false;
    if (this.blocking && !opts.unblockable && sign(src.x - this.x) === this.facing) {
      blocked = true;
      dmg *= 0.2;
      kb *= 0.4;
    }
    if (this.buffs.giant > 0) { dmg *= 0.8; kb *= 0.3; }
    if (this.frozenT > 0) { dmg *= 1.3; this.frozenT = 0; m.shatter(this); }
    this.hp = Math.max(0, this.hp - dmg);
    this.kbx += kb;
    if (src.buffs.vamp > 0 && !blocked) { src.heal(dmg * 0.8); m.drops(src); }
    src.energy = Math.min(100, src.energy + dmg * 0.7);
    this.energy = Math.min(100, this.energy + dmg * 0.4);
    if (!blocked) {
      this.atk = null;
      this.castT = 0;
      this.dashT = 0;
      if (opts.daze) this.stunT = opts.stun;
      else this.hurtT = opts.stun ?? 0.25;
      this.flash = 0.12;
      if (opts.launch) this.vy = -opts.launch;
    }
    m.onHit(this, src, dmg, blocked, opts);
    if (this.hp <= 0) m.knockout(this, src);
    return blocked ? 'blocked' : 'hit';
  }

  usePower(m, opp) {
    const P = POWERS[this.power];
    this.energy -= P.cost;
    m.announce(this, P.name);
    const f = this.facing, s = this.scale;
    this.castT = 0.3;
    this.castPose = THROW_POWERS.includes(this.power) ? 'throw' : 'cast';
    const hand = { x: this.x + f * 44 * s, y: this.y - 76 * s };
    switch (this.power) {
      case 'fireball':
        m.proj.push({ type: 'fire', x: hand.x, y: hand.y, vx: f * 560, owner: this, dmg: 20, r: 15, life: 2.2 });
        break;
      case 'freeze':
        m.proj.push({ type: 'ice', x: hand.x, y: hand.y, vx: f * 620, owner: this, dmg: 6, r: 12, life: 2 });
        break;
      case 'boomerang':
        m.proj.push({ type: 'boom', x: hand.x, y: hand.y, vx: f * 640, owner: this, dmg: 9, r: 16, life: 3.5, dist: 0, back: false, spin: 0 });
        break;
      case 'teleport': {
        m.puff(this.x, this.y - 55 * s, this);
        let nx = opp.x - opp.facing * 58;
        if (nx < WALL_L + 20 || nx > WALL_R - 20) nx = opp.x + opp.facing * 58;
        this.x = clamp(nx, WALL_L + 14, WALL_R - 14);
        this.y = opp.y;
        this.vy = opp.vy;
        this.facing = sign(opp.x - this.x);
        m.puff(this.x, this.y - 55 * s, this);
        this.castT = 0;
        this.atk = { type: 'punch', t: ATTACKS.punch.startup, hit: true };
        opp.takeHit(m, this, 10 * this.dmgMul, this.facing * 300, { stun: 0.3, unblockable: true, word: 'ОП!' });
        break;
      }
      case 'lightning':
        m.hazards.push({ type: 'bolt', x: opp.x, t: 0, delay: 0.48, owner: this, target: opp, dmg: 26, done: false });
        break;
      case 'giant': this.buffs.giant = 4.5; break;
      case 'speed': this.buffs.speed = 6; break;
      case 'vampire': this.buffs.vamp = 7; break;
      case 'quake':
        m.hazards.push({ type: 'quake', x: this.x + f * 24, dir: f, t: 0, owner: this, target: opp, dmg: 12, done: false });
        m.shake(8);
        break;
      case 'magnet': {
        m.hazards.push({ type: 'magnet', t: 0, owner: this, target: opp });
        const res = opp.takeHit(m, this, 5 * this.dmgMul, 0, { stun: 0.9, daze: true, unblockable: true, word: 'ДЗЫНЬ!' });
        if (res && !opp.out) opp.pull = { to: clamp(this.x + f * 52 * s, WALL_L + 14, WALL_R - 14), t: 0.28 };
        break;
      }
      case 'regen': this.regenT = 1.6; break;
      case 'dash':
        this.castT = 0;
        this.dashT = 0.3;
        this.inv = 0.3;
        this.dashHit = false;
        break;
    }
  }

  updatePose(dt) {
    let target;
    if (this.state === 'ko') target = POSES.ko();
    else if (this.state === 'win') target = POSES.win(this.t);
    else if (this.state === 'lose') target = POSES.stun(this.t);
    else if (this.frozenT > 0) return;
    else if (this.stunT > 0) target = POSES.stun(this.t);
    else if (this.hurtT > 0) target = POSES.hurt();
    else if (this.dashT > 0) target = POSES.dash();
    else if (this.castT > 0) target = POSES[this.castPose]();
    else if (this.atk) {
      const A = ATTACKS[this.atk.type], a = this.atk.t;
      let e = a < A.startup ? a / A.startup : a < A.startup + A.active ? 1 : 1 - (a - A.startup - A.active) / A.recovery;
      this.pose = POSES[this.atk.type](clamp(e, 0, 1));
      return;
    }
    else if (!this.onGround) target = POSES.jump();
    else if (this.blocking) target = POSES.block();
    else if (Math.abs(this.vx) > 10) target = POSES.walk(this.t * this.speedMul() * (this.baseSpeed / 270));
    else target = POSES.idle(this.t);
    this.pose = lerpPose(this.pose, target, 1 - Math.exp(-dt * 22));
  }

  draw(ctx) {
    for (const tr of this.trail) {
      drawStick(ctx, { x: tr.x, y: tr.y, facing: tr.facing, scale: this.scale, pose: tr.pose, def: this.def, t: this.t, alpha: tr.a * 0.22 });
    }
    const s = this.scale;
    if (this.buffs.vamp > 0) {
      ctx.save();
      ctx.strokeStyle = `hsla(345, 75%, ${Theme.figL}%, ${0.35 + Math.sin(this.t * 10) * 0.15})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - 60 * s, 42 * s, 72 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const rot = this.state === 'ko' ? -this.facing * (Math.PI / 2) * Math.min(1, this.koT / 0.35) : 0;
    const blink = this.inv > 0 && this.dashT <= 0 && Math.floor(this.t * 20) % 2 === 0;
    const pts = drawStick(ctx, {
      x: this.x, y: this.y, facing: this.facing, scale: s, pose: this.pose, def: this.def, t: this.t,
      eyes: this.state === 'ko' ? 'x' : 'open', rot, alpha: blink ? 0.4 : 1,
      color: this.flash > 0 ? Theme.margin : undefined,
    });
    this.pts = pts;

    if (this.def.isPlayer && !this.out) {
      // Метка «ты» над головой, чтобы не потерять себя в драке
      const hx = pts.head.x, hy = pts.head.y - pts.hr - 26 * s;
      ctx.save();
      ctx.fillStyle = Theme.margin;
      ctx.beginPath();
      ctx.moveTo(hx - 6, hy); ctx.lineTo(hx + 6, hy); ctx.lineTo(hx, hy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.font = `700 20px ${FONT_HAND}`;
      ctx.textAlign = 'center';
      ctx.fillText('ты', hx, hy - 5);
      ctx.restore();
    }
    if (this.blocking) {
      ctx.save();
      ctx.strokeStyle = Theme.ink;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      const cx = this.x + this.facing * 8 * s, cy = this.y - 66 * s;
      ctx.beginPath();
      if (this.facing > 0) ctx.arc(cx, cy, 46 * s, -0.95, 0.95);
      else ctx.arc(cx, cy, 46 * s, Math.PI - 0.95, Math.PI + 0.95);
      ctx.stroke();
      ctx.restore();
    }
    if (this.frozenT > 0) {
      ctx.save();
      ctx.fillStyle = `hsla(195, 85%, 70%, 0.33)`;
      ctx.strokeStyle = `hsla(195, 75%, ${Theme.figL + 5}%, 0.9)`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(this.x - 30 * s, this.y - 128 * s, 60 * s, 128 * s);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.x - 20 * s, this.y - 110 * s); ctx.lineTo(this.x - 8 * s, this.y - 122 * s);
      ctx.moveTo(this.x - 20 * s, this.y - 94 * s); ctx.lineTo(this.x + 2 * s, this.y - 116 * s);
      ctx.stroke();
      ctx.restore();
    }
    if (this.stunT > 0 || this.state === 'lose') {
      ctx.save();
      ctx.fillStyle = Theme.hi;
      ctx.strokeStyle = Theme.ink;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = this.t * 5 + (i * Math.PI * 2) / 3;
        drawStar(ctx, pts.head.x + Math.cos(a) * 18 * s, pts.head.y - pts.hr - 8 * s + Math.sin(a) * 5 * s, 6 * s);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
