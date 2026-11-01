# 오늘 하루, 내가 담임선생님

2026 신입생 전공탐색 주간(초등교육과, 2026-12-07) 교실 딜레마 투표 게임. 설계·계획: 드라이브 `□학과장/20261026 신입생 전공탐색 주간 프로그램/`.

- 학생(휴대폰): `https://taehyeonglim.github.io/jnue-teacher-day/` (QR `img/qr.png`, `tools/qr/qr.py`로 생성)
- 발표(프로젝터): 같은 주소 + `?host=<키>`. →/Space 다음 단계, ← 이전, 1~7 장면 처음, Q 큰 QR, R 두 번 처음으로
- 리허설: `?local` (Firebase 없이 같은 컴퓨터 탭끼리). `python3 -m http.server 8792 --bind 127.0.0.1` 후 `python3 tools/shots.py <폴더>`
- 장면·유형 문구: `scenes.js` / 테스트: `npm test`
- Firebase: `config.js`(공개 웹 설정), 규칙은 `database.rules.example.json`을 복사해 키를 넣은 `database.rules.json`(커밋 금지) → `firebase deploy --only database`. 리허설·행사 뒤 지우기: `for x in votes presence nicks state/h; do firebase database:remove /$x -f; done` (별명은 행사 끝나면 꼭 지운다)
- 장면 2 영상: 공개 저장소에 넣지 않고 Firebase Hosting(chiron-7a37c.web.app)의 `/m/<발표 키>/scene2.mp4`에 둔다(발표 화면만 키로 주소를 만든다). 바꿀 때는 `media-host/m/<키>/scene2.mp4`(git 제외)를 바꾸고 `firebase deploy --only hosting`. 행사 뒤 내리기: `firebase hosting:disable -f`. 서버가 안 되면 발표 화면에서 노트북 파일을 고른다(로컬 서버면 `media-local/scene2.mp4`).
