// ==UserScript==
// @name         법무통 견적서 자동채움
// @namespace    https://seo-hyeon-seok.github.io/registration-calculator/
// @version      1.0
// @description  등기비용 계산기의 "법무통용 복사" 클립보드 값을 법무통 견적서 입력폼에 자동으로 채워줍니다 (채권 항목은 채우지 않음, 제출은 직접)
// @match        https://www.bmtong.co.kr/partner/estimates/*
// @match        https://bmtong.co.kr/partner/estimates/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 계산기 "법무통용 복사" 버튼이 만드는 순서와 동일해야 함 (채권 제외 7개)
    // 법무통 폼의 실제 항목명 표기: 법무사비용 -> 보수료, 부가세 -> 부가가치세
    const LABEL_ORDER = ['취득세', '지방교육세', '농어촌특별세', '인지대', '증지대', '보수료', '부가가치세'];

    const MEMO_TEXT = `안녕하세요. 최병섭 법무사 사무실입니다.

■ 등기비용《상담•문의》 010-3971-7708

■ 잔금일 당일 해당 부동산으로  방문합니다.
■ 추가비용 없이,  당일 시세 채권만 포함되어 진행됩니다.
■ 견적채택은  예약이 아닙니다. (전화, 문자로 해주셔야 합니다.)

■ 채권포함 상세견적을 받아보고 싶으시면
    https://registry-form-ten.vercel.app/
    링크주소로 계약서, 부동산 신고필증 업로드 해주시면 발송해 드립니다.

등기 관련 문의는 편하게 연락 주세요.
010-3971-7708`;

    function setReactInputValue(input, value) {
        // 포커스를 주면 "부가세" 등 일부 칸이 자체적으로 값을 비우는 사이트 동작이 있어
        // focus/blur는 호출하지 않고 input 이벤트만 전달함
        const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        nativeSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function fillFromClipboard() {
        navigator.clipboard.readText().then(text => {
            const values = text.trim().split('\t');
            if (values.length < LABEL_ORDER.length) {
                alert('클립보드 내용이 올바르지 않습니다. 계산기 페이지에서 "법무통용 복사" 버튼을 먼저 눌러주세요.');
                return;
            }

            const nameInputs = document.querySelectorAll('input[placeholder="항목명"]');
            let filled = 0;
            const missing = [];

            LABEL_ORDER.forEach((label, i) => {
                const nameInput = Array.from(nameInputs).find(el => el.value.trim() === label);
                const row = nameInput ? nameInput.parentElement : null;
                const amountInput = row ? row.querySelector('input[placeholder="금액"]') : null;

                if (!amountInput) {
                    missing.push(label);
                    return;
                }
                setReactInputValue(amountInput, values[i]);
                filled++;
            });

            const memoTextarea = document.querySelector('textarea[placeholder="고객에게 전달할 메모를 입력해주세요."]');
            if (memoTextarea) {
                setReactInputValue(memoTextarea, MEMO_TEXT);
            }

            let msg = `${filled}개 항목을 채웠습니다. (채권 항목은 채우지 않음)\n금액을 확인한 뒤 직접 제출해주세요.`;
            if (missing.length > 0) {
                msg += `\n\n찾지 못한 항목: ${missing.join(', ')}`;
            }
            alert(msg);
        }).catch(err => {
            alert('클립보드를 읽지 못했습니다: ' + err.message);
        });
    }

    const btn = document.createElement('button');
    btn.textContent = '견적 자동채움';
    btn.style.cssText = [
        'position:fixed', 'bottom:24px', 'right:24px', 'z-index:999999',
        'padding:12px 18px', 'background:#3d3229', 'color:#fff',
        'border:none', 'border-radius:8px', 'font-size:14px', 'font-weight:600',
        'cursor:pointer', 'box-shadow:0 2px 8px rgba(0,0,0,0.3)'
    ].join(';');
    btn.addEventListener('click', fillFromClipboard);
    document.body.appendChild(btn);
})();
