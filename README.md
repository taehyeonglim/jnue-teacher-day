# 오늘 하루, 내가 담임선생님

2026 신입생 전공탐색 주간(초등교육과, 2026-12-07) 교실 딜레마 투표 게임. 설계·계획: 드라이브 `□학과장/20261026 신입생 전공탐색 주간 프로그램/`.

- 학생(휴대폰): `https://taehyeonglim.github.io/jnue-teacher-day/` (QR `img/qr.png`, `tools/qr/qr.py`로 생성)
- 발표(프로젝터): 같은 주소 + `?host=<키>`. →/Space 다음 단계, ← 이전, 1~7 장면 처음, Q 큰 QR, R 두 번 처음으로
- 리허설: `?local` (Firebase 없이 같은 컴퓨터 탭끼리). `python3 -m http.server 8792 --bind 127.0.0.1` 후 `python3 tools/shots.py <폴더>`
- 장면·유형 문구: `scenes.js` / 테스트: `npm test`
- Firebase: `config.js`(공개 웹 설정), 규칙은 `database.rules.example.json`을 복사해 키를 넣은 `database.rules.json`(커밋 금지) → `firebase deploy --only database`. 표 지우기: `firebase database:remove /votes -f`
- 장면 2 영상은 `media-local/scene2.mp4`(커밋 금지, 발표 노트북에만)
