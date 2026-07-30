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
    const LABEL_ORDER = ['취득세', '지방교육세', '농어촌특별세', '인지대', '증지대', '법무사비용', '부가세'];

    function setReactInputValue(input, value) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, value);
        // 포커스를 주면 "부가세" 등 일부 칸이 자체적으로 값을 비우는 사이트 동작이 있어
        // focus/blur는 호출하지 않고 input 이벤트만 전달함
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
