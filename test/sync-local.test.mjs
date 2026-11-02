import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSync, memoryStore } from '../sync.js';

const tick = () => new Promise(r => setTimeout(r, 30));

function pair() {
  const store = memoryStore();
  const ch = 'test-' + Math.random();
  const host = createSync({ backend: 'local', hostKey: 'k', store, channel: ch, id: 'host' });
  const a = createSync({ backend: 'local', store, channel: ch, id: 'a' });
  const b = createSync({ backend: 'local', store, channel: ch, id: 'b' });
  return { host, a, b, all: [host, a, b] };
}

test('setState가 다른 인스턴스에 전달된다', async () => {
  const { host, a, all } = pair();
  let got;
  a.onState(s => { got = s; });
  await host.setState({ scene: 3, step: 'vote' });
  await tick();
  assert.deepEqual(got, { scene: 3, step: 'vote' });
  all.forEach(s => s.close());
});

test('같은 사람이 두 번 투표하면 마지막 표만', async () => {
  const { host, a, b, all } = pair();
  await host.setState({ scene: 1, step: 'vote' });
  let t;
  host.onTally(1, x => { t = x; });
  await a.vote(1, 'A');
  await a.vote(1, 'C');
  await b.vote(1, 'C');
  await tick();
  assert.deepEqual(t, { A: 0, B: 0, C: 2, D: 0 });
  all.forEach(s => s.close());
});

test('투표가 닫혔거나 다른 장면이면 거부', async () => {
  const { host, a, all } = pair();
  await host.setState({ scene: 1, step: 'result' });
  assert.equal(await a.vote(1, 'A'), false);
  await host.setState({ scene: 2, step: 'vote' });
  assert.equal(await a.vote(1, 'A'), false);
  assert.equal(await a.vote(2, 'Z'), false);
  assert.equal(await a.vote(2, 'B'), true);
  all.forEach(s => s.close());
});

test('호스트 키가 없으면 setState 불가', async () => {
  const { a, all } = pair();
  await assert.rejects(() => a.setState({ scene: 1, step: 'vote' }));
  all.forEach(s => s.close());
});

test('접속 인원', async () => {
  const { host, all } = pair();
  let n;
  host.onPresence(x => { n = x; });
  await tick();
  assert.equal(n, 2); // 호스트는 세지 않음
  all.forEach(s => s.close());
});

import { encState, decState } from '../sync.js';
test('state 문자열 인코딩', () => {
  for (const s of [{ scene: 0, step: 'situation' }, { scene: 7, step: 'card' }, { scene: 'end', step: 'situation' }])
    assert.deepEqual(decState(encState(s)), s);
  assert.deepEqual(decState(null), { scene: 0, step: 'situation' });
});

import { cleanNick, hostToken } from '../sync.js';
test('별명 다듬기: 앞뒤 공백 제거, 8자 넘으면 거부', () => {
  assert.equal(cleanNick('  하늘 '), '하늘');
  assert.equal(cleanNick('가나다라마바사아'), '가나다라마바사아');
  assert.equal(cleanNick('가나다라마바사아자'), null);
  assert.equal(cleanNick('   '), null);
  assert.equal(cleanNick(42), null);
});

test('호스트 토큰은 키로 시작하고 매번 다르다', () => {
  const a = hostToken('k'), b = hostToken('k');
  assert.ok(a.startsWith('k:') && b.startsWith('k:'));
  assert.notEqual(a, b);
});

test('별명 명단: 접속한 사람의 별명만, 숨긴 사람은 빼고', async () => {
  const { host, a, b, all } = pair();
  let r;
  host.onRoster(x => { r = x; });
  assert.equal(await a.setNick(' 하늘 '), true);
  assert.equal(await b.setNick('너무너무너무긴별명이야'), false);
  await b.setNick('바다');
  await tick();
  assert.deepEqual(r, [{ id: 'a', nick: '하늘' }, { id: 'b', nick: '바다' }]);
  await host.hide('b');
  await tick();
  assert.deepEqual(r, [{ id: 'a', nick: '하늘' }]);
  a.close(); await tick();
  assert.deepEqual(r, []);
  host.close(); b.close(); // a는 위에서 닫음
});

test('호스트가 아니면 숨기기 불가', async () => {
  const { a, all } = pair();
  await assert.rejects(() => a.hide('b'));
  all.forEach(s => s.close());
});

import { cleanQuestion } from '../sync.js';
test('질문 다듬기: 앞뒤 공백 제거, 1~120자', () => {
  assert.equal(cleanQuestion('  임용은 언제 준비해요? '), '임용은 언제 준비해요?');
  assert.equal(cleanQuestion('가'.repeat(120)), '가'.repeat(120));
  assert.equal(cleanQuestion('가'.repeat(121)), null);
  assert.equal(cleanQuestion('  '), null);
  assert.equal(cleanQuestion(null), null);
});

test('마무리 Q&A 상태 인코딩', () => {
  assert.deepEqual(decState(encState({ scene: 'qa', step: 'situation' })), { scene: 'qa', step: 'situation' });
});

test('질문함: 보낸 순서대로, 숨긴 질문은 빼고', async () => {
  const { host, a, b, all } = pair();
  let qs;
  host.onQuestions(x => { qs = x; });
  assert.equal(await a.ask(' 임용 준비는 언제부터? '), true);
  assert.equal(await b.ask(''), false);
  await b.ask('심화과정은 바꿀 수 있나요?');
  await tick();
  assert.deepEqual(qs.map(q => q.text), ['임용 준비는 언제부터?', '심화과정은 바꿀 수 있나요?']);
  await host.hideQuestion(qs[0].id);
  await tick();
  assert.deepEqual(qs.map(q => q.text), ['심화과정은 바꿀 수 있나요?']);
  all.forEach(s => s.close());
});

test('호스트가 아니면 질문 숨기기 불가', async () => {
  const { a, all } = pair();
  await assert.rejects(() => a.hideQuestion('x'));
  all.forEach(s => s.close());
});

test('학과 소개(intro) 상태 인코딩', () => {
  assert.deepEqual(decState(encState({ scene: 'intro', step: 'situation' })), { scene: 'intro', step: 'situation' });
});
