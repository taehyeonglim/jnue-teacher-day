import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, TYPES } from '../scenes.js';
import { tally, typeResult, STEPS } from '../logic.js';

const TYPE_KEYS = ['plan', 'observe', 'care', 'change'];
const COURSES_12 = [
  '교육과정-수업-평가 일체화', '학습동기와 자기조절학습', '영재성과 재능개발',
  '데이터기반 수업분석과 AI피드백', '학교심리검사', '학습 장애 및 부진학생 지도',
  '학부모교육', '학교집단상담', '정서·행동 장애 및 문제 학생 지도',
  '교사리더십', '교육개혁론', '현대사상과 교사',
];

test('장면 7개, 장면마다 선택지 4개에 네 유형이 한 번씩', () => {
  assert.equal(SCENES.length, 7);
  SCENES.forEach((s, i) => {
    assert.equal(s.id, i + 1);
    assert.deepEqual(s.choices.map(c => c.key), ['A', 'B', 'C', 'D']);
    assert.deepEqual([...s.choices.map(c => c.type)].sort(), [...TYPE_KEYS].sort());
    assert.ok(s.cards.length >= 1);
  });
});

test('장면 2만 영상 장면', () => {
  assert.deepEqual(SCENES.filter(s => s.video).map(s => s.id), [2]);
});

test('유형 추천 과목은 심화과정 12과목과 같다', () => {
  assert.deepEqual(Object.keys(TYPES).sort(), [...TYPE_KEYS].sort());
  const all = Object.values(TYPES).flatMap(t => t.courses);
  assert.equal(all.length, 12);
  assert.deepEqual([...all].sort(), [...COURSES_12].sort());
});

test('과목 카드도 심화과정 과목만', () => {
  SCENES.flatMap(s => s.cards).forEach(c => assert.ok(COURSES_12.includes(c.course), c.course));
});

test('typeResult: 한 표면 그 유형 하나', () => {
  const t = SCENES[0].choices[0].type;
  const r = typeResult({ 1: 'A' });
  assert.deepEqual(r.top, [t]);
  assert.equal(r.n, 1);
});

test('typeResult: 동점이면 둘 다', () => {
  const a = SCENES[0].choices.find(c => c.key === 'A').type;
  const k2 = SCENES[1].choices.find(c => c.type !== a).key;
  const r = typeResult({ 1: 'A', 2: k2 });
  assert.equal(r.top.length, 2);
  assert.ok(r.top.includes(a));
});

test('typeResult: 표가 없으면 빈 결과', () => {
  const r = typeResult({});
  assert.deepEqual(r.top, []);
  assert.equal(r.n, 0);
});

test('typeResult: 이상한 값은 무시', () => {
  const r = typeResult({ 1: 'Z', 9: 'A', 3: 'B' });
  assert.equal(r.n, 1);
});

test('tally: 없는 키는 0', () => {
  assert.deepEqual(tally({ x: 'A', y: 'A', z: 'C' }), { A: 2, B: 0, C: 1, D: 0 });
  assert.deepEqual(tally(null), { A: 0, B: 0, C: 0, D: 0 });
});

test('단계 순서', () => {
  assert.deepEqual(STEPS, ['situation', 'vote', 'result', 'talk', 'card']);
});
