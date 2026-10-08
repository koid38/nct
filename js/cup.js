// Турнир: круговой этап (каждый с каждым, 9 туров), затем плей-офф для четырёх лучших.

const WIN_POINTS = 3;

function roundRobin(n) {
  const arr = [...Array(n).keys()];
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([arr[i], arr[n - 1 - i]]);
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop());
  }
  return rounds;
}

const Cup = {
  // Создаёт турнир. Индекс 0 — игрок, 1..9 — соперники по возрастанию силы.
  create(player, diffKey) {
    const shift = DIFFICULTY[diffKey].shift;
    const taken = new Set([player.power]);
    for (const r of ROSTER) taken.add(r.power);
    const spare = POWER_IDS.filter((p) => !taken.has(p));
    const fighters = [{ ...player, isPlayer: true }];
    for (const r of ROSTER) {
      const def = { ...r, stats: { ...r.stats }, skill: clamp(r.skill + shift, 1, 5) };
      if (def.power === player.power) def.power = spare.shift();
      fighters.push(def);
    }
    // Расписание так, чтобы соперники игрока шли от слабого к сильному.
    const slots = roundRobin(10);
    const slotToFighter = [0];
    slots.forEach((pairs, r) => { slotToFighter[pairs[0][1]] = r + 1; });
    const rounds = slots.map((pairs) => pairs.map(([a, b]) => [slotToFighter[a], slotToFighter[b]]));
    return {
      diff: diffKey,
      fighters,
      rounds,
      round: 0,
      results: [],
      stage: 'groups', // groups | semis | final | done
      semis: null,
      final: null,
      champion: null,
      last: null,
    };
  },

  rating(def) {
    const st = def.stats.str + def.stats.spd + def.stats.hp;
    return (def.isPlayer ? 3 : def.skill) + (st - 12) * 0.35;
  },

  simulate(c, a, b, stage) {
    const ra = this.rating(c.fighters[a]) + rand(-0.6, 0.6);
    const rb = this.rating(c.fighters[b]) + rand(-0.6, 0.6);
    const pa = 1 / (1 + Math.exp(-(ra - rb) * 0.7));
    const winner = Math.random() < pa ? a : b;
    return { stage, a, b, winner, margin: Math.round(rand(8, 72)) };
  },

  // Матч игрока на текущем этапе: { opp, label } или null
  playerMatch(c) {
    if (c.stage === 'groups') {
      const pair = c.rounds[c.round].find((p) => p.includes(0));
      return { opp: pair[0] === 0 ? pair[1] : pair[0], label: `Групповой этап · тур ${c.round + 1} из 9` };
    }
    if (c.stage === 'semis') {
      const pair = c.semis.find((p) => p.includes(0));
      if (pair) return { opp: pair[0] === 0 ? pair[1] : pair[0], label: 'Полуфинал' };
    }
    if (c.stage === 'final' && c.final.includes(0)) {
      return { opp: c.final[0] === 0 ? c.final[1] : c.final[0], label: 'Финал' };
    }
    return null;
  },

  standings(c) {
    const rows = c.fighters.map((f, idx) => ({ idx, played: 0, w: 0, l: 0, pts: 0, diff: 0 }));
    for (const r of c.results) {
      if (r.stage !== 'groups') continue;
      const loser = r.winner === r.a ? r.b : r.a;
      const W_ = rows[r.winner], L_ = rows[loser];
      W_.played++; L_.played++;
      W_.w++; L_.l++;
      W_.pts += WIN_POINTS;
      W_.diff += r.margin; L_.diff -= r.margin;
    }
    return rows.sort((x, y) => y.pts - x.pts || y.diff - x.diff || x.idx - y.idx);
  },

  // Записывает бой игрока и двигает турнир дальше.
  recordPlayer(c, won, margin) {
    const pm = this.playerMatch(c);
    if (!pm) return;
    const opp = pm.opp;
    const stage = c.stage;
    const res = { stage, a: 0, b: opp, winner: won ? 0 : opp, margin: Math.max(1, Math.round(margin)) };
    c.results.push(res);
    c.last = { won, opp, margin: res.margin, stage };

    if (stage === 'groups') {
      for (const [a, b] of c.rounds[c.round]) {
        if (a === 0 || b === 0) continue;
        c.results.push(this.simulate(c, a, b, 'groups'));
      }
      c.round++;
      if (c.round >= c.rounds.length) this.startPlayoffs(c);
    } else if (stage === 'semis') {
      const other = c.semis.find((p) => !p.includes(0));
      const o = this.simulate(c, other[0], other[1], 'semis');
      c.results.push(o);
      c.final = [won ? 0 : opp, o.winner];
      c.stage = 'final';
      if (!won) this.finishFinal(c, this.simulate(c, c.final[0], c.final[1], 'final'));
    } else if (stage === 'final') {
      this.finishFinal(c, res);
    }
  },

  startPlayoffs(c) {
    const top = this.standings(c).slice(0, 4).map((r) => r.idx);
    c.top4 = top;
    c.semis = [[top[0], top[3]], [top[1], top[2]]];
    c.stage = 'semis';
    if (!top.includes(0)) {
      const s = c.semis.map(([a, b]) => this.simulate(c, a, b, 'semis'));
      c.results.push(...s);
      c.final = [s[0].winner, s[1].winner];
      c.stage = 'final';
      this.finishFinal(c, this.simulate(c, c.final[0], c.final[1], 'final'));
    }
  },

  finishFinal(c, res) {
    if (!c.results.includes(res)) c.results.push(res);
    c.champion = res.winner;
    c.stage = 'done';
  },

  // Итоговое место игрока
  playerPlace(c) {
    if (c.stage !== 'done') return null;
    if (c.champion === 0) return 1;
    if (c.final.includes(0)) return 2;
    if (c.top4 && c.top4.includes(0)) return 3;
    return this.standings(c).findIndex((r) => r.idx === 0) + 1;
  },

  roundResults(c, roundIdx) {
    if (roundIdx < 0) return [];
    const pairs = c.rounds[roundIdx];
    return pairs.map(([a, b]) => c.results.find((r) => r.stage === 'groups' && ((r.a === a && r.b === b) || (r.a === b && r.b === a)))).filter(Boolean);
  },
};
