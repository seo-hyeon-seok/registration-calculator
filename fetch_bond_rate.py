# 우리은행 국민주택채권 매도단가/수익률/할인율 조회 위젯에서 최신 채권할인율을 가져와 JSON으로 저장
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

WOORI_URL = "https://svc.wooribank.com/svc/Dream?withyou=HBNHB0087"
OUTPUT_FILE = "bond_rate.json"
KST = timezone(timedelta(hours=9))

ROW_PATTERN = re.compile(
    r'<td class="first">(\d{4}\.\d{2}\.\d{2})</td>\s*'
    r'<td>[\d,]+</td>\s*'
    r'<td>[\d.]+</td>\s*'
    r'<td class="end">([\d.]+)</td>'
)


def fetch_month_table(year, month):
    body = urllib.parse.urlencode({
        "MODE": "1",
        "BSDT_YM": f"{year}{month:02d}",
        "STD_YEAR": str(year),
        "STD_MONTH": f"{month:02d}",
    }).encode("utf-8")

    req = urllib.request.Request(
        WOORI_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": WOORI_URL,
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        return res.read().decode("utf-8", errors="replace")


def latest_rate(html):
    rows = ROW_PATTERN.findall(html)
    if not rows:
        return None
    date_str, discount = rows[-1]
    return date_str.replace(".", "-"), float(discount)


def main():
    now = datetime.now(KST)
    result = latest_rate(fetch_month_table(now.year, now.month))

    if result is None:
        # 월초라 이번 달 데이터가 아직 없는 경우 전월 데이터로 재시도
        prev = now.replace(day=1) - timedelta(days=1)
        result = latest_rate(fetch_month_table(prev.year, prev.month))

    if result is None:
        print("[오류] 채권할인율 데이터를 찾지 못했습니다.", file=sys.stderr)
        sys.exit(1)

    date_str, rate = result
    data = {
        "date": date_str,
        "rate": rate,
        "updatedAt": now.isoformat(),
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"채권할인율 저장 완료: {data}")


if __name__ == "__main__":
    main()
