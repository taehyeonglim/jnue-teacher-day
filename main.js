/* 주소로 화면 고르기
   ?host=<키>  발표 화면(프로젝터)   그 밖: 학생 화면(휴대폰)
   ?local      Firebase 대신 같은 컴퓨터 탭끼리(리허설·오프라인) */
import { createSync } from './sync.js';
import { FIREBASE_CONFIG } from './config.js';
import { startHost } from './host.js';
import { startStudent } from './student.js';

const q = new URLSearchParams(location.search);
const hostKey = q.get('host');
const local = q.has('local') || !FIREBASE_CONFIG;
const sync = createSync({ backend: local ? 'local' : 'firebase', config: FIREBASE_CONFIG, hostKey });
const app = document.getElementById('app');

/* ── 연결 끊김 띠 ── */
const net = document.getElementById('net');
let seen = false;
sync.onConnection(ok => {
  if (ok) seen = true;
  net.hidden = ok || !seen && !hostKey;
  net.textContent = hostKey ? '📶 연결 끊김 — 색지 카드를 들어 주세요' : '연결 중…';
});

if (hostKey) startHost(app, sync, { local, hostKey });
else startStudent(app, sync);
