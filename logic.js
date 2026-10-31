/* 집계·유형 계산 — DOM 없음 (node --test로 검사) */
import { SCENES, TYPES } from './scenes.js';

export const STEPS = ['situation', 'vote', 'result', 'talk', 'card'];
export const KEYS = ['A', 'B', 'C', 'D'];

/* 장면 하나의 {익명ID: 선택} → {A,B,C,D} */
export function tally(votes) {
  const out = { A: 0, B: 0, C: 0, D: 0 };
  for (const v of Object.values(votes || {})) if (v in out) out[v]++;
  return out;
}

/* 내 표 {장면id: 선택} → 가장 많이 고른 유형(동점이면 여럿) */
export function typeResult(mine) {
  const counts = Object.fromEntries(Object.keys(TYPES).map(k => [k, 0]));
  let n = 0;
  for (const [sid, key] of Object.entries(mine || {})) {
    const c = SCENES.find(s => s.id === Number(sid))?.choices.find(c => c.key === key);
    if (c) { counts[c.type]++; n++; }
  }
  const max = Math.max(...Object.values(counts));
  const top = n ? Object.keys(counts).filter(k => counts[k] === max) : [];
  return { top, counts, n };
}
