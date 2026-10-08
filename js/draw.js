// Рисование: человечек из палочек, позы, аксессуары, арена-тетрадь.

// Углы конечностей считаются от направления «вниз», плюс — вперёд (куда смотрит боец).
// aF/aB — передняя/задняя рука [плечо, предплечье], lF/lB — ноги [бедро, голень].
const POSES = {
  idle: (t) => ({ lean: 0.1, aF: [0.95 + Math.sin(t * 3.5) * 0.06, 2.35], aB: [0.6, 2.15], lF: [0.32, 0.06], lB: [-0.24, -0.34], dy: Math.sin(t * 3.5) * 1.2 }),
  walk: (t) => {
    const p = t * 11, s = Math.sin(p);
    return {
      lean: 0.15,
      aF: [0.8 - 0.3 * s, 2.0], aB: [0.5 + 0.3 * s, 1.9],
      lF: [0.45 * s, 0.45 * s - 0.35 * Math.max(0, -Math.cos(p))],
      lB: [-0.45 * s, -0.45 * s - 0.35 * Math.max(0, Math.cos(p))],
      dy: -Math.abs(s) * 2,
    };
  },
  jump: () => ({ lean: 0.05, aF: [1.6, 2.3], aB: [1.2, 2.0], lF: [1.2, 0.2], lB: [0.4, -0.5], dy: 0 }),
  punch: (e) => ({ lean: 0.12 + 0.18 * e, aF: [lerp(0.95, 1.62, e), lerp(2.35, 1.6, e)], aB: [lerp(0.6, 0.2, e), lerp(2.15, 2.5, e)], lF: [0.45, 0.1], lB: [-0.4, -0.45], dy: 2 }),
  kick: (e) => ({ lean: lerp(0.1, -0.35, e), aF: [lerp(0.95, 1.9, e), 2.4], aB: [lerp(0.6, -0.6, e), lerp(2.15, -0.2, e)], lF: [lerp(0.32, 1.62, e), lerp(0.06, 1.55, e)], lB: [-0.12, -0.05], dy: 0 }),
  block: () => ({ lean: -0.08, aF: [1.25, 2.95], aB: [1.05, 2.85], lF: [0.4, 0.0], lB: [-0.35, -0.5], dy: 5 }),
  hurt: () => ({ lean: -0.4, aF: [0.3, -0.2], aB: [-0.8, -0.4], lF: [0.4, 0.3], lB: [-0.2, -0.3], dy: 0 }),
  stun: (t) => ({ lean: -0.15 + Math.sin(t * 6) * 0.15, aF: [0.15, 0.05], aB: [-0.1, -0.15], lF: [0.15, 0.25], lB: [-0.15, -0.1], dy: 4 }),
  cast: () => ({ lean: -0.1, aF: [2.7, 3.0], aB: [2.5, 2.9], lF: [0.3, 0.1], lB: [-0.3, -0.4], dy: 0 }),
  throw: () => ({ lean: 0.25, aF: [1.57, 1.57], aB: [-0.5, 0], lF: [0.45, 0.1], lB: [-0.4, -0.45], dy: 2 }),
  dash: () => ({ lean: 0.65, aF: [1.5, 1.55], aB: [-1.0, -0.7], lF: [0.9, 0.3], lB: [-0.9, -1.1], dy: 6 }),
  win: (t) => ({ lean: -0.05, aF: [2.8 + Math.sin(t * 8) * 0.2, 3.0], aB: [2.8 - Math.sin(t * 8) * 0.2, 3.05], lF: [0.2, 0.05], lB: [-0.2, -0.05], dy: -Math.abs(Math.sin(t * 5)) * 6 }),
  ko: () => ({ lean: -0.05, aF: [2.6, 2.9], aB: [2.9, 3.1], lF: [0.15, 0.15], lB: [-0.1, -0.1], dy: 0 }),
};

function lerpPose(a, b, k) {
  return {
    lean: lerp(a.lean, b.lean, k),
    aF: [lerp(a.aF[0], b.aF[0], k), lerp(a.aF[1], b.aF[1], k)],
    aB: [lerp(a.aB[0], b.aB[0], k), lerp(a.aB[1], b.aB[1], k)],
    lF: [lerp(a.lF[0], b.lF[0], k), lerp(a.lF[1], b.lF[1], k)],
    lB: [lerp(a.lB[0], b.lB[0], k), lerp(a.lB[1], b.lB[1], k)],
    dy: lerp(a.dy, b.dy, k),
  };
}

// o: { x, y, facing, scale, pose, def, t, alpha, eyes: 'open'|'x', rot, color }
function drawStick(ctx, o) {
  const s = o.scale || 1, f = o.facing, P = o.pose;
  const TH = 27 * s, SH = 27 * s, TO = 38 * s, UA = 22 * s, FA = 21 * s, HR = 11.5 * s;
  const col = o.color || figColor(o.def);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.rot) { ctx.translate(o.x, o.y); ctx.rotate(o.rot); ctx.translate(-o.x, -o.y); }

  const legH = Math.max(
    Math.cos(P.lF[0]) * TH + Math.cos(P.lF[1]) * SH,
    Math.cos(P.lB[0]) * TH + Math.cos(P.lB[1]) * SH);
  const hip = { x: o.x, y: o.y - legH + (P.dy || 0) * s };
  const neck = { x: hip.x + Math.sin(P.lean) * TO * f, y: hip.y - Math.cos(P.lean) * TO };
  const sh = { x: lerp(hip.x, neck.x, 0.9), y: lerp(hip.y, neck.y, 0.9) };
  const hd = HR + 3.5 * s;
  const head = { x: neck.x + Math.sin(P.lean) * hd * f, y: neck.y - Math.cos(P.lean) * hd };
  const limb = (base, a1, l1, a2, l2) => {
    const j = { x: base.x + Math.sin(a1) * l1 * f, y: base.y + Math.cos(a1) * l1 };
    const e = { x: j.x + Math.sin(a2) * l2 * f, y: j.y + Math.cos(a2) * l2 };
    return [base, j, e];
  };
  const armF = limb(sh, P.aF[0], UA, P.aF[1], FA);
  const armB = limb(sh, P.aB[0], UA, P.aB[1], FA);
  const legF = limb(hip, P.lF[0], TH, P.lF[1], SH);
  const legB = limb(hip, P.lB[0], TH, P.lB[1], SH);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4.6 * s;
  ctx.strokeStyle = col;
  const poly = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke(); };

  // Дальние конечности чуть бледнее — так читается глубина.
  ctx.globalAlpha = (o.alpha ?? 1) * 0.6;
  poly(armB); poly(legB);
  ctx.globalAlpha = o.alpha ?? 1;
  poly([hip, neck]);
  poly(legF); poly(armF);

  // Голова
  ctx.beginPath();
  ctx.arc(head.x, head.y, HR, 0, Math.PI * 2);
  ctx.fillStyle = Theme.paper;
  ctx.fill();
  ctx.stroke();

  // Глаза
  ctx.fillStyle = col;
  const ex1 = head.x + f * 2.5 * s, ex2 = head.x + f * 7 * s, ey = head.y - 1.5 * s;
  if (o.eyes === 'x') {
    ctx.lineWidth = 1.8 * s;
    for (const ex of [ex1, ex2]) {
      ctx.beginPath();
      ctx.moveTo(ex - 2 * s, ey - 2 * s); ctx.lineTo(ex + 2 * s, ey + 2 * s);
      ctx.moveTo(ex + 2 * s, ey - 2 * s); ctx.lineTo(ex - 2 * s, ey + 2 * s);
      ctx.stroke();
    }
  } else {
    for (const ex of [ex1, ex2]) { ctx.beginPath(); ctx.arc(ex, ey, 1.9 * s, 0, Math.PI * 2); ctx.fill(); }
  }

  drawAccessory(ctx, o.def.acc, head, HR, f, col, o.t || 0, s);
  ctx.restore();
  return { head, hip, neck, handF: armF[2], footF: legF[2], hr: HR };
}

function drawAccessory(ctx, acc, h, r, f, col, t, s) {
  if (!acc || acc === 'none') return;
  ctx.save();
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.beginPath();
  switch (acc) {
    case 'cap':
      ctx.arc(h.x, h.y - r * 0.2, r * 1.04, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(h.x, h.y - r * 0.25);
      ctx.lineTo(h.x + f * r * 1.8, h.y - r * 0.2);
      ctx.lineWidth = 4 * s;
      ctx.stroke();
      break;
    case 'crown': {
      const y0 = h.y - r * 0.7, x0 = h.x - r * 0.95, w = r * 1.9;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0, y0 - r * 0.9);
      ctx.lineTo(x0 + w * 0.25, y0 - r * 0.45);
      ctx.lineTo(x0 + w * 0.5, y0 - r * 1.15);
      ctx.lineTo(x0 + w * 0.75, y0 - r * 0.45);
      ctx.lineTo(x0 + w, y0 - r * 0.9);
      ctx.lineTo(x0 + w, y0);
      ctx.closePath();
      ctx.fillStyle = Theme.hi;
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'band': {
      const y = h.y - r * 0.4;
      ctx.lineWidth = 4 * s;
      ctx.strokeStyle = Theme.margin;
      ctx.moveTo(h.x - r * 0.98, y); ctx.lineTo(h.x + r * 0.98, y);
      const bx = h.x - f * r, w1 = Math.sin(t * 12) * 3 * s, w2 = Math.cos(t * 10) * 3 * s;
      ctx.moveTo(bx, y); ctx.lineTo(bx - f * r * 1.1, y + r * 0.5 + w1);
      ctx.moveTo(bx, y); ctx.lineTo(bx - f * r * 1.2, y - r * 0.1 + w2);
      ctx.stroke();
      break;
    }
    case 'horns':
      for (const side of [-1, 1]) {
        const bx = h.x + side * r * 0.55, by = h.y - r * 0.8;
        ctx.moveTo(bx - r * 0.28, by + r * 0.1);
        ctx.quadraticCurveTo(bx + side * r * 0.5, by - r * 0.4, bx + side * r * 0.35, by - r * 1.1);
        ctx.quadraticCurveTo(bx + side * r * 0.1, by - r * 0.3, bx + r * 0.28, by + r * 0.05);
        ctx.closePath();
      }
      ctx.fill();
      break;
    case 'tophat': {
      const y0 = h.y - r * 0.75;
      ctx.fillRect(h.x - r * 0.75, y0 - r * 1.7, r * 1.5, r * 1.7);
      ctx.lineWidth = 4 * s;
      ctx.moveTo(h.x - r * 1.3, y0); ctx.lineTo(h.x + r * 1.3, y0);
      ctx.stroke();
      ctx.fillStyle = Theme.margin;
      ctx.fillRect(h.x - r * 0.75, y0 - r * 0.55, r * 1.5, r * 0.35);
      break;
    }
    case 'bow': {
      const cx = h.x - f * r * 0.55, cy = h.y - r * 1.0;
      ctx.moveTo(cx, cy); ctx.lineTo(cx - r * 0.85, cy - r * 0.55); ctx.lineTo(cx - r * 0.85, cy + r * 0.45); ctx.closePath();
      ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.85, cy - r * 0.55); ctx.lineTo(cx + r * 0.85, cy + r * 0.45); ctx.closePath();
      ctx.fillStyle = Theme.margin;
      ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      break;
    }
    case 'mohawk':
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + f * (-0.9 + i * 0.5);
        const bx = h.x + Math.cos(a) * r, by = h.y + Math.sin(a) * r;
        const tx = h.x + Math.cos(a) * r * 1.9, ty = h.y + Math.sin(a) * r * 1.9;
        const px = -Math.sin(a) * r * 0.28, py = Math.cos(a) * r * 0.28;
        ctx.moveTo(bx + px, by + py); ctx.lineTo(tx, ty); ctx.lineTo(bx - px, by - py); ctx.closePath();
      }
      ctx.fill();
      break;
  }
  ctx.restore();
}

// Неровная линия земли: заранее посчитанные смещения, чтобы не дрожала.
const GROUND_WOBBLE = Array.from({ length: 41 }, (_, i) => Math.sin(i * 1.7) * 1.4 + Math.sin(i * 0.53) * 1.8);

function drawArena(ctx) {
  ctx.fillStyle = Theme.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = Theme.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 24) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = 6; y <= H; y += 24) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  // Красные поля, как в школьной тетради
  ctx.strokeStyle = Theme.margin;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(WALL_L - 6, 0); ctx.lineTo(WALL_L - 6, H); ctx.moveTo(WALL_R + 6, 0); ctx.lineTo(WALL_R + 6, H); ctx.stroke();
  // Земля
  ctx.strokeStyle = Theme.ink;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < GROUND_WOBBLE.length; i++) {
    const x = (i / (GROUND_WOBBLE.length - 1)) * W, y = GROUND + 2 + GROUND_WOBBLE[i];
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  // Штриховка под землёй
  ctx.strokeStyle = Theme.inkSoft;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = -40; x < W; x += 18) { ctx.moveTo(x, H); ctx.lineTo(x + 40, GROUND + 10); }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Неровный кружок «от руки»
function scribbleCircle(ctx, x, y, r, seed = 0) {
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = r * (1 + Math.sin(a * 3 + seed) * 0.12 + Math.sin(a * 5 + seed * 2) * 0.06);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

// Портрет бойца для карточек вне боя
function drawPortrait(canvas, def, t, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth || 160, ch = canvas.clientHeight || 160;
  if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const sc = (ch / 150) * (opts.scale || 1);
  const pose = opts.pose ? opts.pose(t) : POSES.idle(t);
  drawStick(ctx, { x: cw / 2 - (opts.facing || 1) * 6 * sc, y: ch - 14 * sc, facing: opts.facing || 1, scale: sc, pose, def, t });
}
