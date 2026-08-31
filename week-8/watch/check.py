#!/usr/bin/env python3
"""
2027년 숙소 예약이 열렸는지 지켜봅니다.

숙소 달력은 대부분 자바스크립트가 나중에 채웁니다. 그래서 단순 조회로는
아무것도 보이지 않고, 실제 브라우저로 열어 다 그려진 뒤에 읽어야 합니다.

두 가지 방식으로 봅니다.

  text  페이지 내용이 바뀌었는지 · 정한 낱말이 새로 나타났는지
  form  날짜 칸을 찾아 실제로 채우고 조회한 뒤, 자리가 있는지

form 이 훨씬 정확합니다. 칸의 선택자를 미리 적을 필요는 없고,
흔히 쓰이는 이름과 placeholder 로 스스로 찾습니다.

  watch/targets.json  감시 목록
  watch/state.json    지난번에 본 것 (자동 갱신)
  watch/snap/         화면 갈무리
  watch/report.md     이번 결과

바뀐 것이 있으면 종료 코드 10 을 돌려줍니다.
워크플로가 그걸 보고 GitHub 이슈를 만들어 메일로 알려 줍니다.
"""

import json
import os
import re
import sys
import hashlib
import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
TARGETS = HERE / "targets.json"
STATE = HERE / "state.json"
SNAP = HERE / "snap"
REPORT = HERE / "report.md"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

# 쿠키 배너 — 스페인 사이트는 이걸 닫아야 내용이 보입니다
COOKIE = re.compile(
    r"(aceptar|acepto|entendido|de acuerdo|guardar y aceptar|permitir|"
    r"accept|agree|got it|allow)", re.I)

# 날짜 칸으로 보이는 것들
IN_HINT = re.compile(r"(entrada|llegada|checkin|check-in|check_in|arrival|desde|inicio|from)", re.I)
OUT_HINT = re.compile(r"(salida|checkout|check-out|check_out|departure|hasta|fin|to)", re.I)
DATE_HINT = re.compile(r"(fecha|date|dia|día|calendar)", re.I)

# 조회 버튼
GO = re.compile(r"(buscar|consultar|comprobar|ver disponibilidad|disponibilidad|"
                r"reservar|search|check|book)", re.I)


def norm(text):
    """매번 달라지는 것들을 걷어냅니다 — 시각, 세션 토큰, 공백."""
    t = text or ""
    t = re.sub(r"\d{1,2}:\d{2}(:\d{2})?", " ", t)
    t = re.sub(r"[0-9a-f]{16,}", " ", t, flags=re.I)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def load(p, d):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return d


def fmts(iso):
    """YYYY-MM-DD 를 여러 표기로."""
    y, m, d = iso.split("-")
    return [iso, "%s/%s/%s" % (d, m, y), "%s-%s-%s" % (d, m, y),
            "%s/%s/%s" % (m, d, y), "%s.%s.%s" % (d, m, y)]


def close_cookies(page):
    for sel in ["button", "a", "[role=button]", "input[type=button]", "input[type=submit]"]:
        try:
            for el in page.query_selector_all(sel)[:40]:
                try:
                    txt = (el.inner_text() or el.get_attribute("value") or "").strip()
                except Exception:
                    continue
                if txt and COOKIE.search(txt) and len(txt) < 40:
                    try:
                        el.click(timeout=1500)
                        page.wait_for_timeout(600)
                        return True
                    except Exception:
                        pass
        except Exception:
            pass
    return False


def describe(el):
    bits = []
    for a in ("name", "id", "placeholder", "aria-label", "type"):
        try:
            v = el.get_attribute(a)
        except Exception:
            v = None
        if v:
            bits.append("%s=%s" % (a, v))
    return " ".join(bits)[:120]


def find_date_inputs(page):
    """날짜 칸 두 개(입실·퇴실)를 찾아 돌려줍니다."""
    dates = page.query_selector_all("input[type=date]")
    if len(dates) >= 2:
        return dates[0], dates[1], "input[type=date] 두 개"
    if len(dates) == 1:
        return dates[0], None, "input[type=date] 하나"

    cands = []
    for el in page.query_selector_all("input"):
        try:
            if (el.get_attribute("type") or "text").lower() in ("hidden", "checkbox", "radio",
                                                                "submit", "button", "file"):
                continue
            if not el.is_visible():
                continue
        except Exception:
            continue
        blob = describe(el)
        if DATE_HINT.search(blob) or IN_HINT.search(blob) or OUT_HINT.search(blob):
            cands.append((el, blob))

    a = next((e for e, b in cands if IN_HINT.search(b)), None)
    b = next((e for e, bb in cands if OUT_HINT.search(bb) and e is not a), None)
    if a is None and cands:
        a = cands[0][0]
        b = cands[1][0] if len(cands) > 1 else None
    how = "이름·placeholder 로 찾음 (%d개 후보)" % len(cands)
    return a, b, how


def fill_date(page, el, iso):
    """여러 표기를 차례로 넣어 봅니다."""
    if el is None:
        return None
    try:
        t = (el.get_attribute("type") or "").lower()
    except Exception:
        t = ""
    tries = [iso] if t == "date" else fmts(iso)
    for v in tries:
        try:
            el.click(timeout=2500)
            el.fill("")
            el.fill(v)
            page.wait_for_timeout(350)
            got = el.input_value()
            if got:
                page.keyboard.press("Escape")
                return v
        except Exception:
            continue
    return None


def click_go(page):
    for sel in ["button", "input[type=submit]", "a"]:
        for el in page.query_selector_all(sel)[:60]:
            try:
                txt = (el.inner_text() or el.get_attribute("value") or "").strip()
                if txt and GO.search(txt) and len(txt) < 40 and el.is_visible():
                    el.click(timeout=3000)
                    return txt
            except Exception:
                continue
    return None


def probe_form(page, t, log):
    """날짜를 넣고 조회한 뒤 결과 문구를 돌려줍니다."""
    a, b, how = find_date_inputs(page)
    log.append("날짜 칸: %s" % how)
    if a is None:
        log.append("날짜 칸을 찾지 못했습니다 — 내용 비교로 대신합니다")
        return None

    v1 = fill_date(page, a, t.get("checkin") or t.get("date"))
    v2 = fill_date(page, b, t.get("checkout") or "") if b is not None else None
    log.append("입력: 입실 %s · 퇴실 %s" % (v1 or "실패", v2 or "-"))
    if not v1:
        return None

    page.wait_for_timeout(800)
    btn = click_go(page)
    log.append("조회 버튼: %s" % (btn or "찾지 못함 (Enter 로 시도)"))
    if not btn:
        try:
            a.press("Enter")
        except Exception:
            pass
    try:
        page.wait_for_load_state("networkidle", timeout=25000)
    except Exception:
        pass
    page.wait_for_timeout(int(t.get("wait", 6000)))
    return page.inner_text("body")


def verdict(body, t):
    low = (body or "").lower()
    miss = [k for k in (t.get("miss") or []) if k.lower() in low]
    hit = [k for k in (t.get("hit") or []) if k.lower() in low]
    if miss:
        return "없음", miss
    if hit:
        return "있을 수 있음", hit
    return "판단 못 함", []


def main():
    cfg = load(TARGETS, {})
    targets = [t for t in cfg.get("targets", []) if not t.get("off")]
    targets = [t for t in targets if (t.get("url") or "").startswith("http")]
    if not targets:
        REPORT.write_text("감시 대상이 없습니다.\n", encoding="utf-8")
        print("감시 대상이 없습니다.")
        return 0

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright 가 없습니다: pip install playwright && playwright install chromium")
        return 1

    state = load(STATE, {})
    SNAP.mkdir(exist_ok=True)
    today = datetime.date.today().isoformat()
    changed, lines = [], []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--no-sandbox"])
        ctx = browser.new_context(user_agent=UA, locale="es-ES",
                                  viewport={"width": 1360, "height": 1800})
        for t in targets:
            tid = t["id"]
            label = "%s · %s · %s" % (t.get("name", tid), t.get("city", ""), t.get("date", ""))
            log = []
            page = ctx.new_page()
            try:
                page.goto(t["url"], wait_until="domcontentloaded", timeout=60000)
                try:
                    page.wait_for_load_state("networkidle", timeout=25000)
                except Exception:
                    pass
                close_cookies(page)
                page.wait_for_timeout(int(t.get("wait", 6000)))

                mode = t.get("mode", "text")
                body = None
                if mode == "form":
                    body = probe_form(page, t, log)
                if body is None:
                    sel = (t.get("sel") or "").strip()
                    if sel:
                        node = page.query_selector(sel)
                        body = node.inner_text() if node else ""
                    else:
                        body = page.inner_text("body")

                clean = norm(body)
                digest = hashlib.sha256(clean.encode("utf-8")).hexdigest()[:16]
                found = [k for k in (t.get("keys") or []) if k.lower() in clean.lower()]
                say, why = verdict(clean, t) if mode == "form" else ("—", [])

                prev = state.get(tid, {})
                ph, pf, ps = prev.get("hash"), prev.get("found", []), prev.get("say")
                fresh = [k for k in found if k not in pf]

                if ph is None:
                    lines.append("- **%s**\n  - 처음 확인했습니다. 다음부터 변화를 알립니다."
                                 % label)
                elif mode == "form" and say == "있을 수 있음" and ps != "있을 수 있음":
                    changed.append(tid)
                    lines.append("- 🔴 **%s**\n  - **자리가 있을 수 있습니다** — %s\n  - %s"
                                 % (label, ", ".join(why), t["url"]))
                elif fresh:
                    changed.append(tid)
                    lines.append("- 🔴 **%s**\n  - 새 낱말: **%s**\n  - %s"
                                 % (label, ", ".join(fresh), t["url"]))
                elif digest != ph:
                    changed.append(tid)
                    lines.append("- 🟡 **%s**\n  - 내용이 바뀌었습니다.\n  - %s"
                                 % (label, t["url"]))
                else:
                    lines.append("- %s — 그대로 (%s)" % (label, say))

                if log:
                    lines.append("  - `%s`" % " / ".join(log))

                try:
                    page.screenshot(path=str(SNAP / ("%s-%s.png" % (tid, today))))
                except Exception:
                    pass

                state[tid] = {"hash": digest, "found": found, "say": say,
                              "checked": today, "url": t["url"], "mode": mode}
            except Exception as e:
                lines.append("- ⚠ **%s**\n  - 열지 못했습니다: %s" % (label, e))
            finally:
                page.close()
        browser.close()

    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    head = "## 숙소 예약 확인 · %s\n\n" % today
    if changed:
        head += ("**%d 군데가 달라졌습니다.** 링크를 열어 2027년 5월이 잡히는지 확인하세요.\n\n"
                 % len(changed))
    else:
        head += "달라진 곳이 없습니다.\n\n"
    out = head + "\n".join(lines) + "\n"
    REPORT.write_text(out, encoding="utf-8")
    print(out)

    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(out)

    return 10 if changed else 0


if __name__ == "__main__":
    sys.exit(main())
