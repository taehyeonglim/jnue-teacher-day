/* 학생 화면(휴대폰) — 지금 장면의 선택지 4개, 마지막에 내 교사 유형 */
import { SCENES, TYPES } from './scenes.js';
import { typeResult } from './logic.js';

const MINE = 'jnue-teacher-day.mine';
const loadMine = () => JSON.parse(localStorage.getItem(MINE) || '{}');
const saveMine = m => localStorage.setItem(MINE, JSON.stringify(m));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function startStudent(app, sync) {
  document.body.classList.add('student');
  let mine = loadMine();
  let st = { scene: 0, step: 'situation' };

  function render() {
    if (st.scene === 0) { mine = {}; saveMine(mine); return wait(); } // 시작 전이면 지난 리허설 표를 지운다
    if (st.scene === 'end') return result();
    scene(SCENES.find(s => s.id === st.scene));
  }

  /* ── 대기 ── */
  function wait() {
    app.innerHTML = `
      <section class="s-wait">
        <p class="kicker">2026 신입생 전공탐색 주간 · 초등교육과</p>
        <h1>오늘 하루,<br>내가 <em>담임선생님</em></h1>
        <p class="ok">✓ 접속 완료!</p>
        <p class="muted">곧 시작합니다. 앞 화면을 봐 주세요.</p>
        <figure class="s-qr"><img src="img/qr.png" alt="휴대폰 접속 QR">
          <figcaption>📱 휴대폰 카메라로 찍으면 바로 참여!</figcaption></figure>
      </section>`;
  }

  /* ── 장면 ── */
  function scene(s) {
    const open = st.step === 'vote';
    const pick = mine[s.id];
    const hint = st.step === 'situation'
      ? (s.video ? '🎬 앞 화면의 영상을 봐 주세요' : '👀 상황을 읽어 보세요. 곧 투표가 열립니다')
      : open ? '하나를 골라 주세요. 투표가 닫히기 전에는 바꿀 수 있어요'
      : pick ? '투표 마감! 앞 화면을 봐 주세요' : '이번 장면은 투표하지 않았어요';
    app.innerHTML = `
      <section class="s-scene">
        <p class="badge">${s.id} / 7 · ${esc(s.time)}</p>
        <h2>${esc(s.title)}</h2>
        <p class="prompt">${esc(s.prompt)}</p>
        <p class="hint ${open ? 'open' : ''}">${hint}</p>
        <div class="choices ${open ? '' : 'locked'}">
          ${s.choices.map(c => `
            <button class="choice ${pick === c.key ? 'on' : ''}" data-k="${c.key}" ${open ? '' : 'disabled'}>
              <b>${c.key}</b><span>${esc(c.text)}</span>
            </button>`).join('')}
        </div>
      </section>`;
    app.querySelectorAll('.choice').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.k;
      app.querySelectorAll('.choice').forEach(x => x.classList.toggle('on', x === b));
      if (await sync.vote(s.id, k)) { mine = { ...mine, [s.id]: k }; saveMine(mine); }
      else { b.classList.remove('on'); render(); }
    }));
  }

  /* ── 결과: 내 교사 유형 ── */
  function result() {
    const r = typeResult(mine);
    if (!r.n) {
      app.innerHTML = `<section class="s-result"><h2>투표한 장면이 없어요</h2>
        <p class="muted">그래도 괜찮아요! 초등과는 네 가지 눈을 모두 배웁니다.</p>${allTypes()}</section>`;
      return;
    }
    const ts = r.top.map(k => TYPES[k]);
    app.innerHTML = `
      <section class="s-result">
        <p class="kicker">내 투표로 본 나의 교사 유형</p>
        ${ts.map(t => `<div class="type"><span class="emoji">${t.emoji}</span><h2>${esc(t.name)}</h2><p>${esc(t.line)}</p></div>`).join('')}
        ${ts.length > 1 ? '<p class="muted">두 유형이 똑같이 나왔어요!</p>' : ''}
        <div class="picks">${SCENES.map(s => {
          const c = s.choices.find(c => c.key === mine[s.id]);
          return `<span class="${c ? 't-' + c.type : 'none'}" title="${esc(s.title)}">${c ? TYPES[c.type].emoji : '·'}</span>`;
        }).join('')}</div>
        <h3>이런 과목이 특히 잘 맞을 거예요</h3>
        <ul class="courses">${[...new Set(ts.flatMap(t => t.courses))].map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        <p class="last">초등과는 이 <b>네 가지 눈</b>을 모두 배웁니다.</p>
        ${allTypes()}
      </section>`;
  }
  const allTypes = () => `<div class="four">${Object.values(TYPES).map(t => `<span>${t.emoji} ${esc(t.name)}</span>`).join('')}</div>`;

  sync.onState(s => {
    const changed = s.scene !== st.scene || s.step !== st.step;
    st = s;
    if (changed) { render(); window.scrollTo(0, 0); }
  });
  render();
}
