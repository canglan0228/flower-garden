"""
ppbc.iplant.cn 浏览器抓取 worker（常驻进程，通过 stdin/stdout JSON 行协议与 Node 通信）。
复用同一个 StealthySession，串行处理搜索与图页请求。
"""
import json
import re
import sys
import time
from urllib.parse import quote

from scrapling import StealthyFetcher
from scrapling.fetchers import StealthySession


def latin_tokens(s):
    s = re.sub(r"[×x]", " ", s or "").lower()
    return [t for t in re.split(r"[^a-z]+", s) if len(t) >= 3]


def norm(s):
    return re.sub(r"\s+", "", s or "")


def score_result(label, name, latin):
    lab = norm(label).lower()
    lname = norm(name)
    toks = latin_tokens(latin)
    score = 0
    if toks and all(t in lab for t in toks):
        score = max(score, 100)
    if lname and lab.startswith(lname):
        score = max(score, 50)
        rest = lab[len(lname):]
        if re.match(r"^[a-z(（]", rest):
            score = max(score, 80)
    return score


def parse_photos(page):
    out = []
    seen = set()
    for a in page.css('a[href^="/tu/"]'):
        m = re.search(r"/tu/(\d+)", a.attrib.get("href") or "")
        text = norm(a.get_all_text() or "")
        if m and text and m.group(1) not in seen:
            seen.add(m.group(1))
            out.append((m.group(1), text))
    return out


session = StealthySession()


def fetch_page(url):
    return StealthyFetcher.fetch(url, session=session, timeout=45000)


def op_search(data):
    name = data.get("name") or ""
    latin = data.get("latin") or ""
    en = data.get("en") or ""
    aliases = data.get("aliases") or []
    for q in [name, latin, en] + list(aliases):
        if not q:
            continue
        url = f"https://ppbc.iplant.cn/list21?keyword={quote(q)}&sel=like"
        page = None
        for _ in range(2):
            page = fetch_page(url)
            if len(page.html_content) >= 20000 and page.css('a[href^="/tu/"]'):
                break
            time.sleep(1.5)
        photos = parse_photos(page)
        best = None
        best_score = -1
        for tu_id, label in photos:
            s = score_result(label, name, latin)
            if s > best_score:
                best_score = s
                best = (tu_id, label)
        if best and best_score >= 80:
            return {"ok": True, "tuId": best[0], "label": best[1], "query": q, "score": best_score}
    return {"ok": False}


def op_page(data):
    tu_id = data.get("tuId")
    page = fetch_page(f"https://ppbc.iplant.cn/tu/{tu_id}")
    html = page.html_content
    m = re.search(r"(?:https?:)?//img\d+\.iplant\.cn/image61/[^\"']+\.(?:jpg|jpeg|png)", html)
    if not m:
        m = re.search(r"(?:https?:)?//img\d+\.iplant\.cn/image2/[^\"']+\.(?:jpg|jpeg|png)", html)
    if not m:
        return {"ok": False, "error": "no image found"}
    full = m.group(0)
    if full.startswith("//"):
        full = "https:" + full
    artist = ""
    i = html.find("摄影师")
    if i >= 0:
        am = re.search(r"<a[^>]*>([^<]+)</a>", html[i : i + 300])
        if am:
            artist = am.group(1).strip()
    tm = re.search(r"<title>([^<]+)</title>", html)
    return {
        "ok": True,
        "full": full,
        "artist": artist or "PPBC",
        "title": tm.group(1).strip() if tm else "",
    }


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        data = json.loads(line)
        op = data.get("op")
        if op == "search":
            out = op_search(data)
        elif op == "page":
            out = op_page(data)
        else:
            out = {"ok": False, "error": "unknown op"}
    except Exception as e:
        out = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    out["id"] = data.get("id")
    sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
    sys.stdout.flush()

session.close()
