/* 공유 상태 — Firebase RTDB 또는 local(같은 컴퓨터 탭끼리, 리허설·오프라인용)
   DB 모양: { state:{scene, step}, votes:{장면:{익명ID:'A'..'D'}}, presence:{익명ID:true},
             nicks:{익명ID:'별명'}, hidden:{익명ID:true},
             questions:{질문ID:{t:'질문', at:시각}}, qhidden:{질문ID:true} }
   (Firebase에서는 hidden이 state/h, qhidden이 state/qh)
   scene: 0 = 시작 화면, 1~7 = 장면, 'end' = 결과, 'qa' = 2부 진로 Q&A */
import { tally, KEYS } from './logic.js';

const ID_KEY = 'jnue-teacher-day.cid';

export function myId() {
  let id = localStorage.getItem(ID_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(ID_KEY, id); }
  return id;
}

/* 서버 규칙과 같은 검사: 지금 장면이고, 투표 단계이고, A~D일 때만 */
export function canVote(state, scene, choice) {
  return !!state && state.scene === scene && state.step === 'vote' && KEYS.includes(choice);
}

/* 별명: 앞뒤 공백을 떼고 1~8자만. 실명이 아니라 '오늘 불릴 별명'(공개 DB라서) */
export function cleanNick(x) {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t.length >= 1 && t.length <= 8 ? t : null;
}

/* 질문함: 앞뒤 공백을 떼고 1~120자만(익명) */
export function cleanQuestion(x) {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t.length >= 1 && t.length <= 120 ? t : null;
}

/* 보낸 순서대로, 숨긴 질문은 빼고 */
const questionList = (qs, hidden) => Object.entries(qs || {})
  .filter(([id, q]) => !hidden?.[id] && q && typeof q.t === 'string')
  .map(([id, q]) => ({ id, text: q.t, at: q.at || 0 }))
  .sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : 1));

/* 호스트가 쓸 때마다 새로 만드는 표식. 규칙은 '키로 시작하고 직전 값과 다를 것'을 요구하므로
   키를 모르는 사람이 state의 일부만 덮어써도(기존 k가 남아) 거부된다 */
export const hostToken = key => `${key}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;

/* 접속 중이고 별명이 있고 숨기지 않은 사람만 */
const roster = (presence, nicks, hidden) => Object.entries(nicks || {})
  .filter(([id]) => presence?.[id] && !hidden?.[id]).map(([id, nick]) => ({ id, nick }));

export function createSync(opts) {
  return opts.backend === 'firebase' ? firebaseSync(opts) : localSync(opts);
}

/* ── local: 저장소(localStorage 또는 메모리) + BroadcastChannel ── */
export function memoryStore() {
  const m = new Map();
  return { get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v) };
}
const lsStore = () => ({ get: k => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v) });

function localSync({ hostKey, store = lsStore(), channel = 'jnue-teacher-day', id = myId() }) {
  const DB = 'jnue-teacher-day.localdb';
  const bc = new BroadcastChannel(channel);
  const subs = new Set();
  const read = () => ({ nicks: {}, hidden: {}, questions: {}, qhidden: {},
    ...JSON.parse(store.get(DB) || '{"state":{"scene":0,"step":"situation"},"votes":{},"presence":{}}') });
  const notify = () => subs.forEach(f => f(read()));
  const write = fn => { const db = read(); fn(db); store.set(DB, JSON.stringify(db)); bc.postMessage(1); notify(); };
  bc.onmessage = notify;
  const on = f => { subs.add(f); f(read()); return () => subs.delete(f); };
  if (!hostKey) write(db => { db.presence[id] = true; });

  return {
    myId: id,
    onState: cb => on(db => cb(db.state)),
    async setState(s) {
      if (!hostKey) throw new Error('호스트만 진행할 수 있습니다');
      write(db => { db.state = { scene: s.scene, step: s.step }; });
    },
    async vote(scene, choice) {
      if (!canVote(read().state, scene, choice)) return false;
      write(db => { (db.votes[scene] ||= {})[id] = choice; });
      return true;
    },
    onTally: (scene, cb) => on(db => cb(tally(db.votes[scene]))),
    onAllVotes: cb => on(db => cb(db.votes)),
    onPresence: cb => on(db => cb(Object.keys(db.presence).length)),
    async setNick(name) {
      const n = cleanNick(name); if (!n) return false;
      write(db => { db.nicks[id] = n; }); return true;
    },
    onRoster: cb => on(db => cb(roster(db.presence, db.nicks, db.hidden))),
    async hide(cid) {
      if (!hostKey) throw new Error('호스트만 숨길 수 있습니다');
      write(db => { db.hidden[cid] = true; });
    },
    async ask(text) {
      const t = cleanQuestion(text); if (!t) return false;
      const at = Date.now();
      write(db => { db.questions[`${id}-${at}-${Math.random().toString(36).slice(2, 6)}`] = { t, at }; }); return true;
    },
    onQuestions: cb => on(db => cb(questionList(db.questions, db.qhidden))),
    async hideQuestion(qid) {
      if (!hostKey) throw new Error('호스트만 숨길 수 있습니다');
      write(db => { db.qhidden[qid] = true; });
    },
    onConnection: cb => { cb(true); return () => {}; },
    async reset() { write(db => { db.votes = {}; db.state = { scene: 0, step: 'situation' }; }); },
    close() { if (!hostKey) write(db => { delete db.presence[id]; }); bc.close(); subs.clear(); },
  };
}

/* ── Firebase RTDB ──
   state는 { v:'장면:단계', k:hostToken(키), h:{숨긴 익명ID:true} }. 규칙상 v·h만 누구나 읽고 k는 읽을 수 없다
   (database.rules.example.json). 표·별명 지우기는 규칙 밖(관리자)에서: firebase database:remove /votes, /nicks */
export const encState = s => `${s.scene}:${s.step}`;
export function decState(v) {
  if (!v) return { scene: 0, step: 'situation' };
  const [a, step] = v.split(':');
  return { scene: a === 'end' || a === 'qa' ? a : Number(a), step };
}

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

function firebaseSync({ config, hostKey, id = myId() }) {
  const ready = (async () => {
    const { initializeApp } = await import(FB + 'firebase-app.js');
    const d = await import(FB + 'firebase-database.js');
    return { d, db: d.getDatabase(initializeApp(config)) };
  })();
  let state = null;
  const later = fn => (...a) => { let off = () => {}; let dead = false;
    ready.then(r => { if (!dead) off = fn(r, ...a); }); return () => { dead = true; off(); }; };

  ready.then(({ d, db }) => {
    d.onValue(d.ref(db, 'state/v'), s => { state = decState(s.val()); });
    if (!hostKey) {
      const me = d.ref(db, 'presence/' + id);
      d.onValue(d.ref(db, '.info/connected'), s => {
        if (s.val()) d.onDisconnect(me).remove().then(() => d.set(me, true));
      });
    }
  });

  return {
    myId: id,
    onState: later(({ d, db }, cb) => d.onValue(d.ref(db, 'state/v'), s => cb(decState(s.val())))),
    async setState(s) {
      if (!hostKey) throw new Error('호스트만 진행할 수 있습니다');
      const { d, db } = await ready;
      await d.update(d.ref(db, 'state'), { v: encState(s), k: hostToken(hostKey) });
    },
    async vote(scene, choice) {
      if (!canVote(state, scene, choice)) return false;
      const { d, db } = await ready;
      try { await d.set(d.ref(db, `votes/${scene}/${id}`), choice); return true; }
      catch { return false; } // 규칙에 막힘(투표 마감 직후 등)
    },
    onTally: later(({ d, db }, scene, cb) => d.onValue(d.ref(db, 'votes/' + scene), s => cb(tally(s.val())))),
    onAllVotes: later(({ d, db }, cb) => d.onValue(d.ref(db, 'votes'), s => cb(s.val() || {}))),
    onPresence: later(({ d, db }, cb) => d.onValue(d.ref(db, 'presence'), s => cb(s.size))),
    async setNick(name) {
      const n = cleanNick(name); if (!n) return false;
      const { d, db } = await ready;
      try { await d.set(d.ref(db, 'nicks/' + id), n); return true; } catch { return false; }
    },
    onRoster: later(({ d, db }, cb) => {
      const cur = { p: {}, n: {}, h: {} };
      const emit = () => cb(roster(cur.p, cur.n, cur.h));
      const offs = [['p', 'presence'], ['n', 'nicks'], ['h', 'state/h']]
        .map(([k, path]) => d.onValue(d.ref(db, path), s => { cur[k] = s.val() || {}; emit(); }));
      return () => offs.forEach(f => f());
    }),
    async ask(text) {
      const t = cleanQuestion(text); if (!t) return false;
      const { d, db } = await ready;
      try { await d.push(d.ref(db, 'questions'), { t, at: d.serverTimestamp() }); return true; } catch { return false; }
    },
    onQuestions: later(({ d, db }, cb) => {
      const cur = { q: {}, h: {} };
      const emit = () => cb(questionList(cur.q, cur.h));
      const offs = [['q', 'questions'], ['h', 'state/qh']]
        .map(([k, path]) => d.onValue(d.ref(db, path), s => { cur[k] = s.val() || {}; emit(); }));
      return () => offs.forEach(f => f());
    }),
    async hideQuestion(qid) {
      if (!hostKey) throw new Error('호스트만 숨길 수 있습니다');
      const { d, db } = await ready;
      await d.update(d.ref(db, 'state'), { ['qh/' + qid]: true, k: hostToken(hostKey) });
    },
    async hide(cid) {
      if (!hostKey) throw new Error('호스트만 숨길 수 있습니다');
      const { d, db } = await ready;
      await d.update(d.ref(db, 'state'), { ['h/' + cid]: true, k: hostToken(hostKey) });
    },
    onConnection: later(({ d, db }, cb) => d.onValue(d.ref(db, '.info/connected'), s => cb(!!s.val()))),
    async reset() {
      const { d, db } = await ready;
      await d.update(d.ref(db, 'state'), { v: encState({ scene: 0, step: 'situation' }), k: hostToken(hostKey) });
    },
    close() {},
  };
}
