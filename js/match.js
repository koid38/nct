// Один бой: два бойца, снаряды, эффекты, таймер и интерфейс поверх арены.

const ROUND_TIME = 60;

class Match {
  // opts: { a, b, ctrlA, ctrlB, label, onEnd }
  constructor(opts) {
    this.f = [new Fighter(opts.a, -1), new Fighter(opts.b, 1)];
    this.ctrl = [opts.ctrlA, opts.ctrlB];
    this.label = opts.label || '';
    this.onEnd = opts.onEnd;
    this.proj = [];
    this.hazards = [];
    this.parts = [];
    this.pops = [];
    this.phase = 'intro'; // intro | fight | ko | end
    this.phaseT = 0;
    this.timer = ROUND_TIME;
    this.shakeA = 0;
    this.slow = 1;
    this.hitstop = 0;
    this.paused = false;
    this.result = null;
    this.ended = false;
    this.banner = null;
    this.t = 0;
  }

  update(rdt) {
    if (this.paused) return;
    this.t += rdt;
    this.shakeA = Math.max(0, this.shakeA - rdt * 40);
    if (this.hitstop > 0) { this.hitstop -= rdt; return; }
    this.slow = Math.min(1, this.slow + rdt * 0.6);
    const dt = rdt * this.slow;
    this.phaseT += rdt;
    const [a, b] = this.f;

    if (this.phase === 'intro' && this.phaseT > 2.1) { this.phase = 'fight'; this.phaseT = 0; }
    if (this.phase === 'fight') {
      this.timer -= dt;
      if (this.timer <= 0) { this.timer = 0; this.timeUp(); }
    }
    for (let i = 0; i < 2; i++) {
      this.f[i].input = this.phase === 'fight' ? this.ctrl[i].read(this.f[i], this.f[1 - i], this, dt) : {};
    }
    a.update(dt, this, b);
    b.update(dt, this, a);
    this.separate(a, b);
    this.updateProj(dt);
    this.updateHazards(dt);
    this.updateFx(dt);

    if (this.phase === 'ko' && this.phaseT > 1.5) {
      this.phase = 'end';
      this.phaseT = 0;
      const w = this.f[this.result.winner];
      w.state = 'win';
      this.banner = { text: `Победа: ${w.def.name}`, t: 0 };
    }
    if (this.phase === 'end' && this.phaseT > 2.4 && !this.ended) {
      this.ended = true;
      this.onEnd && this.onEnd(this.result);
    }
  }

  separate(a, b) {
    if (a.out || b.out) return;
    const minD = 38 * (a.scale + b.scale) / 2;
    const dx = b.x - a.x;
    if (Math.abs(dx) < minD && Math.abs(a.y - b.y) < 80) {
      const push = (minD - Math.abs(dx)) / 2, d = sign(dx);
      a.x -= d * push;
      b.x += d * push;
      for (const [p, q] of [[a, b], [b, a]]) {
        if (p.x < WALL_L + 14) { q.x += WALL_L + 14 - p.x; p.x = WALL_L + 14; }
        if (p.x > WALL_R - 14) { q.x -= p.x - (WALL_R - 14); p.x = WALL_R - 14; }
      }
    }
  }

  other(f) { return this.f[0] === f ? this.f[1] : this.f[0]; }

  updateProj(dt) {
    for (const p of this.proj) {
      p.life -= dt;
      const tgt = this.other(p.owner);
      if (p.type === 'boom') {
        p.spin += dt * 22;
        if (!p.back) {
          p.dist += Math.abs(p.vx) * dt;
          if (p.dist > 430 || p.x < WALL_L || p.x > WALL_R) { p.back = true; p.hitDone = false; }
        } else {
          const d = p.owner.x - p.x;
          p.vx = sign(d) * 640;
          p.y = lerp(p.y, p.owner.y - 70 * p.owner.scale, Math.min(1, dt * 4));
          if (Math.abs(d) < 26 || p.owner.out) p.life = 0;
        }
      }
      p.x += p.vx * dt;
      if (p.type !== 'boom' && (p.x < WALL_L - 20 || p.x > WALL_R + 20)) p.life = 0;
      if (Math.random() < dt * 30) this.trailDot(p);

      const hitR = p.r + 16 * tgt.scale;
      if (!p.hitDone && !tgt.out && Math.abs(tgt.x - p.x) < hitR && p.y > tgt.y - 122 * tgt.scale - p.r && p.y < tgt.y + p.r) {
        const kb = sign(p.vx) * (p.type === 'fire' ? 360 : 160);
        const res = tgt.takeHit(this, p.owner, p.dmg * p.owner.dmgMul, kb, {
          stun: p.type === 'fire' ? 0.35 : 0.25,
          word: p.type === 'fire' ? 'ПЫХ!' : p.type === 'ice' ? 'ДЗИНЬ!' : 'ВЖИК!',
        });
        if (res) {
          p.hitDone = true;
          if (p.type === 'ice' && res === 'hit' && !tgt.out) { tgt.frozenT = 1.8; tgt.hurtT = 0; }
          if (p.type !== 'boom') p.life = 0;
        }
      }
    }
    this.proj = this.proj.filter((p) => p.life > 0);
  }

  updateHazards(dt) {
    for (const h of this.hazards) {
      h.t += dt;
      if (h.type === 'bolt') {
        if (!h.done && h.t >= h.delay) {
          h.done = true;
          this.shake(10);
          this.sparks(h.x, GROUND - 20, 18, 52);
          if (Math.abs(h.target.x - h.x) < 50) {
            h.target.takeHit(this, h.owner, h.dmg * h.owner.dmgMul, 0, { stun: 0.55, daze: true, unblockable: true, word: 'ТРЕСЬ!' });
          }
        }
        if (h.t > h.delay + 0.3) h.dead = true;
      } else if (h.type === 'quake') {
        h.x += h.dir * 640 * dt;
        if (Math.random() < dt * 40) this.dust(h.x, 1);
        if (!h.done && h.target.onGround && Math.abs(h.target.x - h.x) < 34) {
          h.done = true;
          h.target.takeHit(this, h.owner, h.dmg * h.owner.dmgMul, h.dir * 200, { stun: 0.35, daze: true, unblockable: true, launch: 300, word: 'БДЫЩ!' });
        }
        if (h.x < WALL_L - 30 || h.x > WALL_R + 30) h.dead = true;
      } else if (h.type === 'magnet') {
        if (h.t > 0.45) h.dead = true;
      }
    }
    this.hazards = this.hazards.filter((h) => !h.dead);
  }

  updateFx(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.g ?? 900) * dt;
      if (p.y > GROUND + 2 && p.g !== 0) { p.y = GROUND + 2; p.vx *= 0.6; p.vy = 0; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.pops) { p.t += dt; p.y -= dt * 30; }
    this.pops = this.pops.filter((p) => p.t < p.life);
    if (this.banner) this.banner.t += dt;
  }

  // ——— события ———
  onHit(tgt, src, dmg, blocked, opts) {
    const hx = opts.hx ?? (tgt.x - sign(tgt.x - src.x) * 10);
    const hy = opts.hy ?? tgt.y - 70 * tgt.scale;
    if (blocked) {
      this.pops.push({ x: hx, y: hy - 10, text: 'блок', t: 0, life: 0.6, size: 26, col: Theme.inkSoft, rot: rand(-0.2, 0.2) });
      this.sparks(hx, hy, 4, 0, Theme.inkSoft);
      this.shake(2);
      return;
    }
    const word = opts.word || pick(HIT_WORDS);
    this.pops.push({ x: hx, y: hy - 20, text: word, sub: `−${Math.round(dmg)}`, t: 0, life: 0.8, size: 30 + dmg * 1.3, col: Theme.ink, rot: rand(-0.25, 0.25) });
    this.sparks(hx, hy, 6 + Math.round(dmg), 0, figColor(tgt.def));
    this.shake(Math.min(14, 3 + dmg * 0.6));
    this.hitstop = Math.min(0.09, 0.03 + dmg * 0.003);
  }

  knockout(loser, winner) {
    if (this.phase !== 'fight' && this.phase !== 'intro') return;
    loser.state = 'ko';
    loser.atk = null;
    loser.vy = -320;
    loser.kbx += sign(loser.x - winner.x) * 260;
    this.phase = 'ko';
    this.phaseT = 0;
    this.slow = 0.25;
    this.shake(16);
    this.result = { winner: this.f.indexOf(winner), hp: this.f.map((x) => x.hp / x.maxHp), ko: true };
    this.banner = { text: 'Нокаут!', t: 0 };
  }

  timeUp() {
    const [a, b] = this.f;
    const w = a.hp / a.maxHp >= b.hp / b.maxHp ? 0 : 1;
    this.f[1 - w].state = 'lose';
    this.f[w].state = 'fight';
    this.phase = 'ko';
    this.phaseT = 0;
    this.result = { winner: w, hp: this.f.map((x) => x.hp / x.maxHp), ko: false };
    this.banner = { text: 'Время!', t: 0 };
  }

  forfeit(idx) {
    if (this.ended) return;
    this.ended = true;
    this.result = { winner: 1 - idx, hp: this.f.map((x, i) => (i === idx ? 0 : x.hp / x.maxHp)), ko: true, forfeit: true };
    this.onEnd && this.onEnd(this.result);
  }

  announce(f, text) {
    this.pops.push({ x: f.x, y: f.y - 150 * f.scale, text, t: 0, life: 1.1, size: 30, col: figColor(f.def), rot: 0, hand: true });
  }

  shake(v) { this.shakeA = Math.max(this.shakeA, v); }

  sparks(x, y, n, spreadX = 0, col) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(120, 380);
      this.parts.push({ x: x + rand(-spreadX, spreadX), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: rand(0.3, 0.6), max: 0.6, r: rand(2, 4), col: col || Theme.hi });
    }
  }
  dust(x, n) {
    for (let i = 0; i < n; i++) {
      this.parts.push({ x: x + rand(-14, 14), y: GROUND, vx: rand(-80, 80), vy: rand(-140, -40), life: rand(0.25, 0.45), max: 0.45, r: rand(2, 3.5), col: Theme.inkSoft, g: 500 });
    }
  }
  puff(x, y, f) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.parts.push({ x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 0.4, max: 0.4, r: 5, col: figColor(f.def, 0.7), g: 0, ring: true });
    }
  }
  shatter(f) {
    for (let i = 0; i < 12; i++) {
      this.parts.push({ x: f.x + rand(-25, 25), y: f.y - rand(10, 120), vx: rand(-220, 220), vy: rand(-300, -60), life: 0.6, max: 0.6, r: rand(3, 6), col: 'hsla(195, 80%, 70%, 0.9)', shard: true });
    }
  }
  drops(f) {
    for (let i = 0; i < 4; i++) {
      this.parts.push({ x: f.x + rand(-20, 20), y: f.y - rand(40, 110), vx: rand(-30, 30), vy: rand(-80, -20), life: 0.6, max: 0.6, r: 3.5, col: `hsla(345, 75%, ${Theme.figL}%, 0.9)`, g: -60 });
    }
  }
  plus(f) {
    this.parts.push({ x: f.x + rand(-28, 28), y: f.y - rand(20, 110), vx: 0, vy: -60, life: 0.7, max: 0.7, r: 6, col: 'hsl(140, 60%, 45%)', g: 0, plus: true });
  }
  trailDot(p) {
    const col = p.type === 'fire' ? 'hsla(18, 90%, 55%, 0.8)' : p.type === 'ice' ? 'hsla(195, 85%, 65%, 0.8)' : figColor(p.owner.def, 0.6);
    this.parts.push({ x: p.x - sign(p.vx) * 10, y: p.y + rand(-5, 5), vx: -p.vx * 0.1, vy: rand(-30, 30), life: 0.3, max: 0.3, r: rand(2, 4), col, g: 0 });
  }

  // ——— рисование ———
  draw(ctx) {
    ctx.save();
    if (this.shakeA > 0) ctx.translate(rand(-1, 1) * this.shakeA, rand(-1, 1) * this.shakeA);
    drawArena(ctx);
    for (const h of this.hazards) this.drawHazard(ctx, h, true);
    const order = [...this.f].sort((x, y) => (x.out ? -1 : 0) - (y.out ? -1 : 0));
    for (const f of order) f.draw(ctx);
    for (const p of this.proj) this.drawProj(ctx, p);
    for (const h of this.hazards) this.drawHazard(ctx, h, false);
    this.drawParts(ctx);
    this.drawPops(ctx);
    ctx.restore();
    this.drawHud(ctx);
    this.drawBanner(ctx);
  }

  drawProj(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.type === 'fire') {
      ctx.fillStyle = 'hsla(30, 95%, 55%, 0.9)';
      ctx.strokeStyle = 'hsl(8, 85%, 45%)';
      ctx.lineWidth = 3;
      scribbleCircle(ctx, 0, 0, p.r, this.t * 20);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'hsla(50, 100%, 70%, 0.95)';
      scribbleCircle(ctx, sign(p.vx) * 3, 0, p.r * 0.5, this.t * 30);
      ctx.fill();
    } else if (p.type === 'ice') {
      ctx.rotate(this.t * 6);
      ctx.fillStyle = 'hsla(195, 85%, 75%, 0.85)';
      ctx.strokeStyle = 'hsl(200, 70%, 45%)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -p.r); ctx.lineTo(p.r * 0.6, 0); ctx.lineTo(0, p.r); ctx.lineTo(-p.r * 0.6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (p.type === 'boom') {
      ctx.rotate(p.spin);
      ctx.strokeStyle = figColor(p.owner.def);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-p.r, -p.r * 0.5); ctx.lineTo(0, p.r * 0.4); ctx.lineTo(p.r, -p.r * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHazard(ctx, h, behind) {
    ctx.save();
    if (h.type === 'bolt' && behind && !h.done) {
      ctx.strokeStyle = Theme.margin;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(h.t * 30);
      ctx.beginPath();
      ctx.ellipse(h.x, GROUND + 4, 50, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (h.type === 'bolt' && !behind && h.done) {
      const k = 1 - (h.t - h.delay) / 0.3;
      ctx.strokeStyle = Theme.hi;
      ctx.lineWidth = 10 * k + 2;
      ctx.lineJoin = 'round';
      ctx.shadowColor = Theme.hi;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      let x = h.x + rand(-10, 10);
      ctx.moveTo(x, 0);
      for (let y = 40; y <= GROUND; y += 40) { x = h.x + rand(-22, 22); ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = Theme.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (h.type === 'quake' && behind) {
      ctx.strokeStyle = figColor(h.owner.def);
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const bx = h.x - h.dir * i * 22;
        ctx.moveTo(bx - 12, GROUND + 2);
        ctx.lineTo(bx - 4, GROUND - 18 + i * 4);
        ctx.lineTo(bx + 4, GROUND - 6);
        ctx.lineTo(bx + 12, GROUND - 26 + i * 5);
        ctx.lineTo(bx + 18, GROUND + 2);
      }
      ctx.stroke();
    } else if (h.type === 'magnet' && !behind) {
      const a = h.owner, b = h.target;
      ctx.strokeStyle = figColor(a.def, 1 - h.t / 0.45);
      ctx.lineWidth = 2.5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        const y1 = a.y - 75 * a.scale, y2 = b.y - 70 * b.scale;
        ctx.moveTo(a.x, y1);
        ctx.quadraticCurveTo((a.x + b.x) / 2, (y1 + y2) / 2 + i * 40, b.x, y2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawParts(ctx) {
    ctx.save();
    for (const p of this.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.col;
      ctx.strokeStyle = p.col;
      if (p.plus) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x - p.r, p.y); ctx.lineTo(p.x + p.r, p.y);
        ctx.moveTo(p.x, p.y - p.r); ctx.lineTo(p.x, p.y + p.r);
        ctx.stroke();
      } else if (p.ring) {
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.shard) {
        ctx.beginPath(); ctx.moveTo(p.x, p.y - p.r); ctx.lineTo(p.x + p.r * 0.6, p.y); ctx.lineTo(p.x, p.y + p.r); ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  drawPops(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.pops) {
      const k = p.t / p.life;
      const sc = p.t < 0.1 ? 0.6 + p.t * 4 : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(sc, sc);
      ctx.font = `700 ${Math.round(p.size)}px ${FONT_HAND}`;
      if (!p.hand) {
        ctx.lineWidth = 6;
        ctx.strokeStyle = Theme.paper;
        ctx.strokeText(p.text, 0, 0);
      }
      ctx.fillStyle = p.col;
      ctx.fillText(p.text, 0, 0);
      if (p.sub) {
        ctx.font = `700 22px ${FONT_HAND}`;
        ctx.fillStyle = Theme.margin;
        ctx.fillText(p.sub, 0, p.size * 0.6);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawHud(ctx) {
    const [a, b] = this.f;
    this.drawBars(ctx, a, 24, 1);
    this.drawBars(ctx, b, W - 24, -1);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = Theme.card;
    ctx.strokeStyle = Theme.ink;
    ctx.lineWidth = 2.5;
    scribbleCircle(ctx, W / 2, 48, 30, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.timer < 10 ? Theme.margin : Theme.ink;
    ctx.font = `700 38px ${FONT_HAND}`;
    ctx.fillText(String(Math.ceil(this.timer)), W / 2, 50);
    ctx.font = `500 13px ${FONT_UI}`;
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText(this.label, W / 2, 96);
    ctx.restore();
  }

  drawBars(ctx, f, x0, dir) {
    const bw = 360, bh = 18, y = 46;
    const x = dir > 0 ? x0 : x0 - bw;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = dir > 0 ? 'left' : 'right';
    ctx.font = `700 30px ${FONT_HAND}`;
    ctx.fillStyle = figColor(f.def);
    ctx.fillText(f.def.name, x0, 38);
    const nameW = ctx.measureText(f.def.name).width;
    ctx.font = `400 13px ${FONT_UI}`;
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText(POWERS[f.power].name, x0 + dir * (nameW + 10), 36);

    // здоровье
    const pct = f.hp / f.maxHp, ghost = f.hpShown / f.maxHp;
    ctx.fillStyle = Theme.card;
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = Theme.margin;
    ctx.globalAlpha = 0.45;
    if (dir > 0) ctx.fillRect(x, y, bw * ghost, bh); else ctx.fillRect(x + bw * (1 - ghost), y, bw * ghost, bh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = figColor(f.def);
    if (dir > 0) ctx.fillRect(x, y, bw * pct, bh); else ctx.fillRect(x + bw * (1 - pct), y, bw * pct, bh);
    ctx.strokeStyle = Theme.ink;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, bw, bh);
    ctx.font = `500 12px ${FONT_UI}`;
    ctx.fillStyle = Theme.ink;
    ctx.textAlign = dir > 0 ? 'right' : 'left';
    ctx.fillText(`${Math.ceil(f.hp)} / ${f.maxHp}`, dir > 0 ? x + bw - 6 : x + 6, y + bh + 15);

    // энергия суперсилы
    const ew = 230, eh = 10, ey = y + bh + 6;
    const ex = dir > 0 ? x : x0 - ew;
    const cost = POWERS[f.power].cost;
    ctx.fillStyle = Theme.card;
    ctx.fillRect(ex, ey, ew, eh);
    ctx.fillStyle = Theme.hi;
    if (dir > 0) ctx.fillRect(ex, ey, ew * f.energy / 100, eh); else ctx.fillRect(ex + ew * (1 - f.energy / 100), ey, ew * f.energy / 100, eh);
    ctx.strokeStyle = Theme.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ex, ey, ew, eh);
    const cx = dir > 0 ? ex + ew * cost / 100 : ex + ew * (1 - cost / 100);
    ctx.beginPath(); ctx.moveTo(cx, ey - 3); ctx.lineTo(cx, ey + eh + 3); ctx.stroke();
    if (f.canAfford() && !f.out) {
      ctx.textAlign = dir > 0 ? 'left' : 'right';
      ctx.font = `700 20px ${FONT_HAND}`;
      ctx.fillStyle = Theme.margin;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 8);
      ctx.fillText('суперсила готова!', x0, ey + 30);
      ctx.globalAlpha = 1;
    }

    // активные эффекты
    const tags = [];
    if (f.buffs.giant > 0) tags.push(`Гигант ${f.buffs.giant.toFixed(1)}`);
    if (f.buffs.speed > 0) tags.push(`Скорость ${f.buffs.speed.toFixed(1)}`);
    if (f.buffs.vamp > 0) tags.push(`Вампиризм ${f.buffs.vamp.toFixed(1)}`);
    if (f.regenT > 0) tags.push('Регенерация');
    if (f.frozenT > 0) tags.push('Заморожен');
    if (tags.length) {
      ctx.font = `500 12px ${FONT_UI}`;
      ctx.fillStyle = Theme.inkSoft;
      ctx.textAlign = dir > 0 ? 'left' : 'right';
      ctx.fillText(tags.join(' · '), x0, ey + 50);
    }
    ctx.restore();
  }

  drawBanner(ctx) {
    let text = null, sub = null, k = 1;
    if (this.phase === 'intro') {
      if (this.phaseT < 1.3) { text = `${this.f[0].def.name} против ${this.f[1].def.name}`; sub = this.label; }
      else { text = 'Бой!'; k = Math.min(1, (this.phaseT - 1.3) * 5); }
    } else if (this.banner && this.phase !== 'fight') {
      text = this.banner.text;
      k = Math.min(1, this.banner.t * 5);
    }
    if (this.paused) { text = 'Пауза'; sub = 'Esc или P — продолжить'; k = 1; }
    if (!text) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(W / 2, H / 2 - 40);
    ctx.rotate(-0.04);
    ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
    const size = text.length > 16 ? 54 : 84;
    ctx.font = `700 ${size}px ${FONT_HAND}`;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = Theme.hi;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-tw / 2 - 18, -size * 0.32, tw + 36, size * 0.62);
    ctx.globalAlpha = 1;
    ctx.fillStyle = Theme.onHi;
    ctx.fillText(text, 0, 0);
    if (sub) {
      ctx.font = `500 18px ${FONT_UI}`;
      ctx.fillStyle = Theme.inkSoft;
      ctx.fillText(sub, 0, size * 0.62);
    }
    ctx.restore();
  }
}
