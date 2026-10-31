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
