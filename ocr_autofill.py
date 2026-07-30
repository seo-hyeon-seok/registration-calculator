# 클립보드의 법무통 견적요청 카드 스크린샷을 Gemini로 분석해 등기비용 계산기 웹페이지를 자동 채움 URL로 엽니다
import hashlib
import json
import re
import time
import webbrowser
from urllib.parse import urlencode

from PIL import ImageGrab

CLIPBOARD_WAIT_TIMEOUT_SEC = 120
CLIPBOARD_POLL_INTERVAL_SEC = 1

GEMINI_API_KEY_FILE = r"D:\reo\Works\이전_매매\기본파일\gemini_api_key.txt"
CALCULATOR_URL = "https://seo-hyeon-seok.github.io/registration-calculator/"

PROMPT = """법무통 사이트의 "견적요청" 카드 이미지입니다. 카드에 표시된 항목을 그대로 읽어
아래 JSON 형식으로만 출력하세요. 추측하지 말고, 카드에 없거나 읽을 수 없는 항목은
빈 문자열이나 false로 두세요.

{
  "client_name": "카드 상단 'OOO 님의 견적요청'의 이름",
  "property_type": "종류/상세종류가 아파트·주택이면 apartment, 상가·오피스텔이면 commercial, 농지·토지면 land",
  "sale_price": "거래금액 숫자만 (원 단위, 콤마·원 제거)",
  "tax_rate_percent": "취득세율 숫자만 (예: 1.69)",
  "address": "소재지상세 + 동/호수를 합친 전체 주소 (예: '경기도 부천시 원미구 도약로 36 (상동, 라일락마을) 2314동 803호')",
  "under_85sqm": "전용면적란에 '85㎡ 이하'라고 적혀있으면 true, '85㎡ 초과'면 false. 전용면적 항목 자체가 카드에 없으면(표시 안 됨, '-' 등) true",
  "tax_discount": "메모에 신생아 관련 감면 언급이 있으면 newborn, 생애최초만 언급되면 firstTime, 감면 언급이 없으면 none",
  "request_date": "요청일자 YYYY-MM-DD",
  "payment_date": "잔금예정일 YYYY-MM-DD",
  "memo": "메모 텍스트 그대로"
}

JSON으로만 답하세요."""


def load_api_key():
    with open(GEMINI_API_KEY_FILE, 'r', encoding='utf-8') as f:
        return f.read().strip()


def image_hash(img):
    return hashlib.md5(img.tobytes()).hexdigest()


def wait_for_new_clipboard_image():
    baseline = ImageGrab.grabclipboard()
    baseline_hash = image_hash(baseline) if baseline is not None else None

    print(f"클립보드에 새 이미지가 복사되기를 기다리는 중... (Win+Shift+S로 견적요청 카드를 캡쳐하세요, 최대 {CLIPBOARD_WAIT_TIMEOUT_SEC}초)")
    elapsed = 0
    while elapsed < CLIPBOARD_WAIT_TIMEOUT_SEC:
        img = ImageGrab.grabclipboard()
        if img is not None and image_hash(img) != baseline_hash:
            return img
        time.sleep(CLIPBOARD_POLL_INTERVAL_SEC)
        elapsed += CLIPBOARD_POLL_INTERVAL_SEC

    raise RuntimeError(f"{CLIPBOARD_WAIT_TIMEOUT_SEC}초 동안 새 이미지가 감지되지 않았습니다. 다시 실행해주세요.")


def analyze(img):
    import google.generativeai as genai

    genai.configure(api_key=load_api_key())
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content([PROMPT, img])

    text = response.text
    match = re.search(r'```json\s*([\s\S]*?)\s*```', text) or re.search(r'\{[\s\S]*\}', text)
    json_str = match.group(1) if match and match.lastindex else (match.group() if match else text)
    return json.loads(json_str)


def build_url(data):
    params = {
        'type': data.get('property_type') or 'apartment',
        'clientName': data.get('client_name', ''),
        'address': data.get('address', ''),
        'salePrice': str(data.get('sale_price', '')).replace(',', '').replace('원', '').strip(),
        'under85': '0' if data.get('under_85sqm') is False else '1',
        'taxDiscount': data.get('tax_discount') or 'none',
    }
    return CALCULATOR_URL + '?' + urlencode(params)


def main():
    img = wait_for_new_clipboard_image()

    print("Gemini 분석 중...")
    data = analyze(img)
    print(f"인식 결과: {data}")

    if not data.get('sale_price'):
        print("[경고] 거래금액을 인식하지 못했습니다. 카드 이미지를 다시 확인해주세요.")

    tax_rate = data.get('tax_rate_percent')
    if tax_rate:
        print(f"참고: 카드에 표시된 취득세율 {tax_rate}% (계산기 결과와 육안 대조용, 자동입력되지 않음)")

    payment_date = data.get('payment_date')
    if payment_date:
        print(f"참고: 잔금예정일 {payment_date} (계산기에는 반영되지 않음)")

    url = build_url(data)
    print(f"계산기 페이지 열기: {url}")
    webbrowser.open(url)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[오류] {e}")
        input("엔터를 눌러 종료하세요...")
