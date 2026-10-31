/* 발표 화면(프로젝터) — →/Space 다음 단계, ← 이전, 1~7 장면 처음, Q QR 크게, R 처음으로 */
import { SCENES, TYPES } from './scenes.js';
import { STEPS, typeResult } from './logic.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STUDENT_URL = location.origin + location.pathname;

/* 진행 순서: 시작 → 장면마다 5단계 → 결과 */
const ORDER = [{ scene: 0, step: 'situation' },
  ...SCENES.flatMap(s => STEPS.map(step => ({ scene: s.id, step }))),
  { scene: 'end', step: 'situation' }];
const idxOf = st => Math.max(0, ORDER.findIndex(o => o.scene === st.scene && o.step === st.step));

export function startHost(app, sync, { local }) {
  document.body.classList.add('host');
  let i = 0, n = 0, tallies = {}, allVotes = {}, offTally = () => {};

  /* ── 화면 ── */
  function render() {
    const o = ORDER[i];
    if (o.scene === 0) return start();
    if (o.scene === 'end') return end();
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
        </div>
        <figure class="qr"><img src="img/qr.png" alt="접속 QR"><figcaption>${esc(STUDENT_URL.replace(/^https?:\/\//, ''))}</figcaption></figure>
      </section>`;
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
        ${video ? `<div class="vid"><video src="media-local/scene2.mp4" controls playsinline></video>
            <p class="novid" hidden>영상 파일 없음 — media-local/scene2.mp4 를 넣어 주세요</p></div>`
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
      v.addEventListener('error', () => { v.hidden = true; app.querySelector('.novid').hidden = false; });
      v.play().catch(() => {});
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
      </section>`;
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

  /* 시계: 13:20부터 마무리 알림 */
  const clock = document.createElement('div'); clock.className = 'clock'; document.body.append(clock);
  const tickClock = () => {
    const d = new Date(), hm = d.getHours() * 60 + d.getMinutes();
    clock.textContent = d.toTimeString().slice(0, 5) + (local ? ' · local' : '');
    document.body.classList.toggle('late', hm >= 13 * 60 + 20 && hm < 14 * 60);
  };
  tickClock(); setInterval(tickClock, 15000);

  sync.onPresence(x => { n = x; const el = document.getElementById('n'); if (el) el.textContent = n; });
  sync.onAllVotes(v => { allVotes = v; if (ORDER[i].scene === 'end') end(); });

  /* 새로고침해도 이어서: 저장된 상태에서 시작 */
  let first = true;
  sync.onState(s => { if (first) { first = false; go(idxOf(s)); } });
}
