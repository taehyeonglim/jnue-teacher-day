/* 공유 상태 — Firebase RTDB 또는 local(같은 컴퓨터 탭끼리, 리허설·오프라인용)
   DB 모양: { state:{scene, step}, votes:{장면:{익명ID:'A'..'D'}}, presence:{익명ID:true} }
   scene: 0 = 시작 화면, 1~7 = 장면, 'end' = 결과 */
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
  const read = () => JSON.parse(store.get(DB) || '{"state":{"scene":0,"step":"situation"},"votes":{},"presence":{}}');
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
    onConnection: cb => { cb(true); return () => {}; },
    async reset() { write(db => { db.votes = {}; db.state = { scene: 0, step: 'situation' }; }); },
    close() { if (!hostKey) write(db => { delete db.presence[id]; }); bc.close(); subs.clear(); },
  };
}

/* ── Firebase RTDB ──
   state는 { v:'장면:단계', k:호스트키 }. 규칙상 v만 누구나 읽고 k는 읽을 수 없다(database.rules.example.json).
   표 지우기는 규칙 밖(관리자)에서: firebase database:remove /votes */
export const encState = s => `${s.scene}:${s.step}`;
export function decState(v) {
  if (!v) return { scene: 0, step: 'situation' };
  const [a, step] = v.split(':');
  return { scene: a === 'end' ? 'end' : Number(a), step };
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
      await d.set(d.ref(db, 'state'), { v: encState(s), k: hostKey });
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
    onConnection: later(({ d, db }, cb) => d.onValue(d.ref(db, '.info/connected'), s => cb(!!s.val()))),
    async reset() {
      const { d, db } = await ready;
      await d.set(d.ref(db, 'state'), { v: encState({ scene: 0, step: 'situation' }), k: hostKey });
    },
    close() {},
  };
}
