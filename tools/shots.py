#!/usr/bin/env python3
"""리허설 스크린샷(local 모드): python3 tools/shots.py <출력폴더> [URL]
발표 탭 1개 + 학생 탭 3개를 한 브라우저에 띄우고 한 바퀴 돌며 찍는다.
먼저: python3 -m http.server 8792 --bind 127.0.0.1"""
import sys, pathlib
from playwright.sync_api import sync_playwright

out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
url = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:8792/"

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context()  # 탭끼리 localStorage·BroadcastChannel 공유 → 학생마다 익명 ID가 같아지므로 init script로 따로 준다
    host = ctx.new_page(); host.set_viewport_size({"width": 1920, "height": 1080})
    host.goto(url + "?local&host=k"); host.wait_for_timeout(800)
    host.evaluate("localStorage.removeItem('jnue-teacher-day.localdb')"); host.reload(); host.wait_for_timeout(800)
    host.keyboard.press("r"); host.keyboard.press("r")
    studs = []
    for i in range(3):
        s = ctx.new_page(); s.set_viewport_size({"width": 390, "height": 844})
        s.add_init_script(f"""(() => {{ const g = Storage.prototype.getItem, st = Storage.prototype.setItem;
          Storage.prototype.getItem = function(k) {{ return k.startsWith('jnue-teacher-day.c') || k.startsWith('jnue-teacher-day.m') ? g.call(this, k + '.{i}') : g.call(this, k); }};
          Storage.prototype.setItem = function(k, v) {{ return k.startsWith('jnue-teacher-day.c') || k.startsWith('jnue-teacher-day.m') ? st.call(this, k + '.{i}', v) : st.call(this, k, v); }}; }})()""")
        s.goto(url + "?local"); studs.append(s)
    host.wait_for_timeout(500)
    host.screenshot(path=str(out / "h00_start.png")); studs[0].screenshot(path=str(out / "s00_wait.png"))

    host.keyboard.press("ArrowRight"); host.wait_for_timeout(2500)  # 학과 소개(홈페이지)
    host.screenshot(path=str(out / "h01_intro.png")); studs[0].screenshot(path=str(out / "s01_intro.png"))
    host.click(".intro-next"); host.wait_for_timeout(300)  # 소개 끝 → 장면 1 상황(아래 루프의 첫 →는 건너뜀)

    picks = ["ABCDBCA", "BBCCADD", "CBACDBA"]  # 학생별 장면 1~7 선택
    for sid in range(1, 8):
        for step in ["situation", "vote", "result", "talk", "card"]:
            if not (sid == 1 and step == "situation"):
                host.keyboard.press("ArrowRight")
            host.wait_for_timeout(250)
            if step == "vote":
                for i, s in enumerate(studs):
                    if not (sid == 4 and i == 2):  # 학생 3은 장면 4를 건너뜀
                        s.click(f".choice[data-k='{picks[i][sid-1]}']"); s.wait_for_timeout(120)
                host.wait_for_timeout(300)
            if sid in (1, 2) or step in ("card",) and sid in (5, 7):
                host.screenshot(path=str(out / f"h{sid}_{step}.png"))
            if sid == 1 and step in ("situation", "vote", "result"):
                studs[0].screenshot(path=str(out / f"s1_{step}.png"))
    host.keyboard.press("ArrowRight"); host.wait_for_timeout(1200)
    host.screenshot(path=str(out / "h99_end.png"))
    for i, s in enumerate(studs):
        s.wait_for_timeout(300); s.screenshot(path=str(out / f"s99_result_{i}.png"), full_page=True)
    host.keyboard.press("q"); host.wait_for_timeout(300); host.screenshot(path=str(out / "h_qr.png"))
    b.close()
print("ok", out)
