/* 학생 화면(휴대폰) — 지금 장면의 선택지 4개, 마지막에 내 교사 유형 */
import { SCENES, TYPES, INTRO_URL } from './scenes.js';
import { typeResult } from './logic.js';

const MINE = 'jnue-teacher-day.mine';
const NICK = 'jnue-teacher-day.nick';
const loadMine = () => JSON.parse(localStorage.getItem(MINE) || '{}');
const saveMine = m => localStorage.setItem(MINE, JSON.stringify(m));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function startStudent(app, sync) {
  document.body.classList.add('student');
  let mine = loadMine();
  let st = null; // 서버 상태를 받기 전(새로고침 직후)에는 내 표를 지우지 않는다
  let nick = localStorage.getItem(NICK), fab = null;
  if (nick) sync.setNick(nick); // 서버 쪽 별명이 지워졌어도 다시 올린다

  function render() {
    if (fab) fab.hidden = st?.scene === 'qa'; // 마무리 Q&A 화면에는 질문 칸이 이미 있음
    if (!st) return wait();
    if (st.scene === 0) { mine = {}; saveMine(mine); return wait(); } // 시작 전이면 지난 리허설 표를 지운다
    if (st.scene === 'end') return result();
    if (st.scene === 'qa') return qa();
    if (st.scene === 'intro') return intro();
    scene(SCENES.find(s => s.id === st.scene));
  }

  /* ── 대기: 별명을 받으면 앞 화면에 뜬다(실명 말고 별명 — 공개 DB) ── */
  function wait() {
    app.innerHTML = `
      <section class="s-wait">
        <p class="kicker">2026 신입생 전공탐색 주간 · 초등교육과</p>
        <h1>오늘 하루,<br>내가 <em>담임선생님</em></h1>
        ${nick ? `
        <p class="ok">✓ 접속 완료!</p>
        <p class="me">오늘의 별명 <b>${esc(nick)}</b> <button type="button" class="link" id="re">바꾸기</button></p>
        <p class="muted">곧 시작합니다. 앞 화면을 봐 주세요.</p>` : `
        <form class="nick">
          <label for="nk">오늘 불릴 별명</label>
          <input id="nk" maxlength="8" autocomplete="off" enterkeyhint="go" placeholder="8자 이내 · 실명 말고 별명!">
          <button>입장</button>
          <p class="err" hidden>1~8자로 적어 주세요</p>
        </form>
        <p class="muted">별명은 앞 화면에 떠요.</p>`}
      </section>`;
    const f = app.querySelector('form.nick');
    if (f) f.addEventListener('submit', async e => {
      e.preventDefault();
      const v = f.querySelector('input').value;
      if (await sync.setNick(v)) { nick = v.trim(); localStorage.setItem(NICK, nick); if (!st || st.scene === 0) wait(); }
      else f.querySelector('.err').hidden = false;
    });
    app.querySelector('#re')?.addEventListener('click', () => { nick = null; wait(); app.querySelector('#nk').focus(); });
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
        <p class="muted qhint">💬 궁금한 건 오른쪽 아래 '질문' 버튼으로! 마무리 Q&A에서 답해요</p>
      </section>`;
  }
  /* ── 학과 소개: 앞 화면과 같은 홈페이지를 휴대폰으로 ── */
  function intro() {
    app.innerHTML = `
      <section class="s-wait">
        <p class="kicker">초등교육과 소개</p>
        <h1>초등교육과는<br><em>무엇을 배울까?</em></h1>
        <p class="muted">앞 화면을 함께 봐 주세요. 소개가 끝나면 교실 딜레마가 시작돼요.</p>
        <a class="ok" href="${INTRO_URL}" target="_blank" rel="noopener">📱 휴대폰으로 같이 보기</a>
      </section>`;
  }

  /* ── 마무리 Q&A ── */
  function qa() {
    app.innerHTML = `
      <section class="s-qa">
        <p class="kicker">마무리 · 질문 Q&A</p>
        <h2>궁금한 것, <em>물어보세요</em></h2>
        <p class="muted">궁금한 것을 익명으로 보내 주세요. 앞 화면에 뜨면 학과장이 답합니다.</p>
        ${askForm()}
        <button type="button" class="link" id="mytype">내 교사 유형 다시 보기</button>
      </section>`;
    bindAsk(app.querySelector('.ask'));
    app.querySelector('#mytype').addEventListener('click', result);
  }

  /* 질문 보내기 칸(마무리 화면·질문 버튼 공용) */
  const askForm = () => `
    <form class="ask">
      <textarea maxlength="120" rows="3" placeholder="예) 심화과정은 나중에 바꿀 수 있나요?"></textarea>
      <button>💬 질문 보내기</button>
      <p class="err" hidden>1~120자로 적어 주세요</p>
    </form>`;
  function bindAsk(f, done) {
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const ta = f.querySelector('textarea');
      if (await sync.ask(ta.value)) { ta.value = ''; f.querySelector('.err').hidden = true; toast('질문을 보냈어요! 마무리 시간에 답해 드릴게요'); done?.(); }
      else f.querySelector('.err').hidden = false;
    });
  }
  function toast(msg) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.append(d);
    setTimeout(() => d.remove(), 2600);
  }

  /* 어느 화면에서나 오른쪽 아래 '질문' 버튼 */
  fab = document.createElement('button');
  fab.className = 'fab'; fab.type = 'button'; fab.textContent = '💬 질문';
  fab.addEventListener('click', () => {
    if (document.querySelector('.qsheet')) return;
    const sh = document.createElement('div'); sh.className = 'qsheet';
    sh.innerHTML = `<div class="box"><p class="kicker">익명 질문 · 마무리 시간에 답해요</p>${askForm()}
      <button type="button" class="link close">닫기</button></div>`;
    document.body.append(sh);
    const close = () => sh.remove();
    sh.querySelector('.close').addEventListener('click', close);
    sh.addEventListener('click', e => { if (e.target === sh) close(); });
    bindAsk(sh.querySelector('.ask'), close);
    sh.querySelector('textarea').focus();
  });
  document.body.append(fab);

  const allTypes = () => `<div class="four">${Object.values(TYPES).map(t => `<span>${t.emoji} ${esc(t.name)}</span>`).join('')}</div>`;

  sync.onState(s => {
    const changed = !st || s.scene !== st.scene || s.step !== st.step;
    st = s;
    if (changed) { render(); window.scrollTo(0, 0); }
  });
  render();
}
