/* 발표 화면(프로젝터) — →/Space 다음 단계, ← 이전, 1~7 장면 처음, Q QR 크게, R 처음으로 */
import { SCENES, TYPES } from './scenes.js';
import { STEPS, typeResult } from './logic.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STUDENT_URL = location.origin + location.pathname;

/* 장면 2 영상: 공개 저장소에 넣지 않는다(학생 얼굴).
   찾는 순서: ① Firebase Hosting의 /m/<발표 키>/scene2.mp4(키를 아는 발표 화면만 주소를 안다)
   ② 로컬 서버의 media-local/scene2.mp4 ③ 전에 고른 파일(IndexedDB) ④ 파일 고르기(비상용).
   서버 영상 올리기: media-host/m/<키>/scene2.mp4 에 두고 firebase deploy --only hosting */
const MEDIA_HOST = 'https://chiron-7a37c.web.app';
function media(mode, fn) {
  return new Promise((ok, bad) => {
    const o = indexedDB.open('jnue-teacher-day', 1);
    o.onupgradeneeded = () => o.result.createObjectStore('media');
    o.onerror = () => bad(o.error);
    o.onsuccess = () => {
      const tx = o.result.transaction('media', mode), r = fn(tx.objectStore('media'));
      tx.oncomplete = () => ok(r.result); tx.onerror = () => bad(tx.error);
    };
  });
}
const loadVideo = () => media('readonly', st => st.get('scene2')).catch(() => null);
const saveVideo = blob => media('readwrite', st => st.put(blob, 'scene2'));
let videoURL = null;

/* 진행 순서: 시작 → 장면마다 5단계 → 결과(1부 끝) → 2부 진로 Q&A */
const ORDER = [{ scene: 0, step: 'situation' },
  ...SCENES.flatMap(s => STEPS.map(step => ({ scene: s.id, step }))),
  { scene: 'end', step: 'situation' }, { scene: 'qa', step: 'situation' }];

/* 2부 이야기 순서(화면 위 칩). 자세한 내용은 건 폴더 2부_진행안.md */
const TALK = ['① 심화과정 고르기', '② 1~4학년, 이렇게 준비해요', '③ 임용과 첫 발령', '④ 교사, 그다음의 길'];
const ANSWERED = 'jnue-teacher-day.answered';
const idxOf = st => Math.max(0, ORDER.findIndex(o => o.scene === st.scene && o.step === st.step));

export function startHost(app, sync, { local, hostKey }) {
  document.body.classList.add('host');
  let i = 0, n = 0, tallies = {}, allVotes = {}, offTally = () => {};

  /* ── 화면 ── */
  function render() {
    const o = ORDER[i];
    if (o.scene === 0) return start();
    if (o.scene === 'end') return end();
    if (o.scene === 'qa') return qa();
    scene(SCENES.find(s => s.id === o.scene), o.step);
  }

  function start() {
    app.innerHTML = `
      <section class="h-start">
        <div>
          <p class="kicker">2026 신입생 전공탐색 주간 · 전주교대 초등교육과</p>
          <h1>오늘 하루,<br>내가 <em>담임선생님</em></h1>
          <p class="sub">여러분은 오늘 3월에 발령받은 초임 담임입니다.<br>하루 동안 일곱 번의 선택을 하게 됩니다.</p>
          <p class="count">📱 접속 <b id="n">${n}</b>명</p>
          <div class="bubbles" id="bub"></div>
        </div>
        <figure class="qr"><img src="img/qr.png" alt="접속 QR"><figcaption>${esc(STUDENT_URL.replace(/^https?:\/\//, ''))}</figcaption></figure>
      </section>`;
    drawBubbles();
  }

  /* 대기 화면 별명 말풍선: 새로 온 사람만 튀어나오게, 클릭하면 화면에서 숨김 */
  let roster = [];
  function drawBubbles() {
    const box = document.getElementById('bub'); if (!box) return;
    const have = new Map([...box.children].map(el => [el.dataset.id, el]));
    for (const { id, nick } of roster) {
      const el = have.get(id);
      if (el) { if (el.textContent !== nick) el.textContent = nick; continue; }
      const b = document.createElement('button');
      b.className = 'bub'; b.dataset.id = id; b.textContent = nick; b.title = '클릭하면 화면에서 숨김';
      b.addEventListener('click', () => { b.remove(); sync.hide(id).catch(e => console.warn('숨기기 실패', e)); });
      box.append(b);
    }
    const ids = new Set(roster.map(r => r.id));
    for (const [id, el] of have) if (!ids.has(id)) el.remove();
  }

  function scene(s, step) {
    const t = tallies[s.id] || { A: 0, B: 0, C: 0, D: 0 };
    const total = t.A + t.B + t.C + t.D;
    const showBars = step === 'result' || step === 'talk' || step === 'card';
    const video = s.video && step === 'situation';
    app.innerHTML = `
      <section class="h-scene step-${step}">
        <header><span class="badge">${s.id} / 7 · ${esc(s.time)}</span><h2>${esc(s.title)}</h2>
          <span class="steps">${STEPS.map(x => `<i class="${x === step ? 'on' : ''}"></i>`).join('')}</span></header>
        ${video ? `<div class="vid"><video controls playsinline></video>
            <div class="novid" hidden><p>🎬 이 노트북에서 장면 2 영상을 골라 주세요</p>
              <label class="pick">영상 파일 고르기<input type="file" accept="video/*" hidden></label>
              <small>드라이브 건 폴더 자료/장면2_이유빈/scene2.mp4 · 한 번 고르면 이 브라우저가 기억합니다</small></div></div>`
          : `<p class="prompt">${esc(s.prompt)}</p>`}
        ${step === 'situation' ? '' : `
        <ol class="opts">${s.choices.map(c => {
          const pct = total ? Math.round(t[c.key] / total * 100) : 0;
          return `<li><b>${c.key}</b><span class="txt">${esc(c.text)}</span>
            <span class="bar" style="--w:${showBars ? pct : 0}%"></span>
            <span class="num">${showBars ? t[c.key] + '명' : ''}</span></li>`;
        }).join('')}</ol>`}
        ${step === 'vote' ? `<p class="live">🗳️ 투표 중 · <b>${total}</b>명 / 접속 ${n}명 <span class="muted">(카드를 든 사람도 세어 주세요)</span></p>` : ''}
        ${step === 'talk' ? '<p class="talk">🙋 왜 그걸 골랐어요?</p>' : ''}
        ${step === 'card' ? `<div class="cards">${s.cards.map((c, j) => `
          <article class="card" style="--d:${j * 0.25}s"><p class="when">${esc(c.when)} · 심화${esc(c.kind)}</p>
            <h3>${esc(c.course)}</h3><p>${esc(c.blurb)}</p></article>`).join('')}
          <p class="note">정답은 없어요. 초등과는 이 문제를 이렇게 공부합니다.</p></div>` : ''}
      </section>`;
    const v = app.querySelector('video');
    if (v) {
      const box = app.querySelector('.novid');
      const show = url => { v.hidden = false; box.hidden = true; v.src = url; v.play().catch(() => {}); };
      const ask = () => { v.hidden = true; box.hidden = false; };
      box.querySelector('input').addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        if (videoURL) URL.revokeObjectURL(videoURL);
        show(videoURL = URL.createObjectURL(f));
        saveVideo(f).catch(err => console.warn('영상 기억 실패', err));
      });
      if (videoURL) return show(videoURL);
      const urls = [`${MEDIA_HOST}/m/${encodeURIComponent(hostKey)}/scene2.mp4`, 'media-local/scene2.mp4'];
      v.addEventListener('loadeddata', () => { videoURL ||= v.currentSrc; }, { once: true }); // 실제로 열린 주소를 기억
      const next = () => {
        const u = urls.shift();
        if (u) { v.addEventListener('error', next, { once: true }); return show(u); }
        loadVideo().then(b => b ? show(videoURL = URL.createObjectURL(b)) : ask());
      };
      next();
    }
  }

  /* 결과: 참여자 전체의 유형 분포 */
  function end() {
    const byCid = {};
    for (const [sid, m] of Object.entries(allVotes)) for (const [cid, k] of Object.entries(m || {})) (byCid[cid] ||= {})[sid] = k;
    const dist = Object.fromEntries(Object.keys(TYPES).map(k => [k, 0]));
    for (const m of Object.values(byCid)) typeResult(m).top.forEach(k => dist[k]++);
    const max = Math.max(1, ...Object.values(dist));
    app.innerHTML = `
      <section class="h-end">
        <p class="kicker">휴대폰을 확인해 보세요 — 나의 교사 유형!</p>
        <h1>우리 반 선생님들은…</h1>
        <div class="dist">${Object.entries(TYPES).map(([k, t]) => `
          <div class="col"><span class="v" style="--h:${dist[k] / max * 100}%">${dist[k]}</span>
            <b>${t.emoji}</b><span>${esc(t.name)}</span></div>`).join('')}</div>
        <p class="last">초등과는 이 <em>네 가지 눈</em>을 모두 배웁니다.</p>
        <p class="qnext">💬 궁금한 건 휴대폰 '질문' 버튼으로 — 2부(14:00)에서 답합니다</p>
      </section>`;
  }

  /* 2부: 진로 이야기 순서 + 익명 질문판. 카드를 누르면 크게, '답했어요'는 이 노트북에만 기억 */
  let questions = [], spot = null;
  const answered = new Set(JSON.parse(localStorage.getItem(ANSWERED) || '[]'));
  function qa() {
    app.innerHTML = `
      <section class="h-qa">
        <header><span class="badge">2부 · 14:00~15:00</span><h2>초등교사, <em>그다음은?</em> 진로 Q&A</h2></header>
        <ol class="talk-steps">${TALK.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
        <p class="qcount">💬 받은 질문 <b id="qn">0</b>개 <span class="muted">· 카드를 누르면 크게 보여요</span></p>
        <div class="qcards" id="qc"></div>
        <figure class="qr-mini"><img src="img/qr.png" alt=""><figcaption>질문은 휴대폰으로</figcaption></figure>
      </section>`;
    drawQuestions();
  }
  function drawQuestions() {
    const box = document.getElementById('qc'); if (!box) return;
    document.getElementById('qn').textContent = questions.length;
    box.innerHTML = questions.map((q, j) => `<button class="qcard ${answered.has(q.id) ? 'done' : ''}" data-j="${j}">
      <span class="no">Q${j + 1}</span>${esc(q.text)}</button>`).join('') || '<p class="muted">아직 질문이 없어요</p>';
    box.querySelectorAll('.qcard').forEach(b => b.addEventListener('click', () => openSpot(+b.dataset.j)));
  }
  function openSpot(j) {
    const q = questions[j]; if (!q) return;
    spot?.remove();
    spot = document.createElement('div'); spot.className = 'spot';
    spot.innerHTML = `<div class="box"><p class="no">Q${j + 1}</p><p class="qt">${esc(q.text)}</p>
      <div class="acts"><button class="ok">✓ 답했어요</button><button class="hide">숨기기</button><button class="x">닫기 (Esc)</button></div></div>`;
    document.body.append(spot);
    const close = () => { spot?.remove(); spot = null; };
    spot.querySelector('.ok').addEventListener('click', () => {
      answered.add(q.id); localStorage.setItem(ANSWERED, JSON.stringify([...answered])); close(); drawQuestions();
    });
    spot.querySelector('.hide').addEventListener('click', () => { close(); sync.hideQuestion(q.id).catch(e => console.warn('숨기기 실패', e)); });
    spot.querySelector('.x').addEventListener('click', close);
  }

  /* ── 진행 ── */
  function go(j) {
    i = Math.min(ORDER.length - 1, Math.max(0, j));
    const o = ORDER[i];
    offTally();
    if (typeof o.scene === 'number' && o.scene > 0)
      offTally = sync.onTally(o.scene, t => { tallies[o.scene] = t; if (ORDER[i] === o && o.step !== 'situation') render(); });
    sync.setState(o).catch(e => console.warn('상태 저장 실패', e));
    render();
  }

  addEventListener('keydown', e => {
    if (spot) { if (e.key === 'Escape') { spot.remove(); spot = null; } return; } // 질문을 크게 띄운 동안은 넘기지 않음
    if (e.target.closest('video') && e.key === ' ') return;
    if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); go(i + 1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(i - 1); }
    else if (/^[1-7]$/.test(e.key)) go(idxOf({ scene: +e.key, step: 'situation' }));
    else if (e.key === 'q' || e.key === 'Q') document.body.classList.toggle('bigqr');
    else if ((e.key === 'r' || e.key === 'R') && confirmReset()) go(0);
  });
  const confirmReset = () => { const b = document.querySelector('.reset-hint'); if (b) return true; flash('R을 한 번 더 누르면 처음으로'); return false; };
  function flash(msg) {
    const d = document.createElement('div'); d.className = 'reset-hint'; d.textContent = msg; document.body.append(d);
    setTimeout(() => d.remove(), 2000);
  }

  /* 큰 QR(Q 키) — 어느 단계에서나 */
  const big = document.createElement('div'); big.className = 'qrbig';
  big.innerHTML = `<img src="img/qr.png" alt=""><p>${esc(STUDENT_URL.replace(/^https?:\/\//, ''))}</p>`;
  document.body.append(big);

  /* 시계: 1부 13:50, 2부 14:50부터 마무리 알림(1부 13:00~14:00, 2부 14:00~15:00) */
  const clock = document.createElement('div'); clock.className = 'clock'; document.body.append(clock);
  const tickClock = () => {
    const d = new Date(), hm = d.getHours() * 60 + d.getMinutes();
    clock.textContent = d.toTimeString().slice(0, 5) + (local ? ' · local' : '');
    const part = ORDER[i]?.scene === 'qa' ? 15 * 60 : 14 * 60;
    document.body.classList.toggle('late', hm >= part - 10 && hm < part + 30);
  };
  tickClock(); setInterval(tickClock, 15000);

  sync.onPresence(x => { n = x; const el = document.getElementById('n'); if (el) el.textContent = n; });
  sync.onRoster(r => { roster = r; drawBubbles(); });
  sync.onQuestions(qs => { questions = qs; drawQuestions(); });
  sync.onAllVotes(v => { allVotes = v; if (ORDER[i].scene === 'end') end(); });

  /* 새로고침해도 이어서: 저장된 상태에서 시작 */
  let first = true;
  sync.onState(s => { if (first) { first = false; go(idxOf(s)); } });
}
