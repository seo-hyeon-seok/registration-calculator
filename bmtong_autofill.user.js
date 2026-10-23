// ==UserScript==
// @name         법무통 견적서 자동채움
// @namespace    https://seo-hyeon-seok.github.io/registration-calculator/
// @version      1.4
// @description  등기비용 계산기의 "법무통용 복사" 클립보드 값을 법무통 견적서 입력폼에 자동으로 채워줍니다 (채권은 시가표준액이 조회된 경우에만 채움, 제출은 직접)
// @match        https://www.bmtong.co.kr/partner/estimates/*
// @match        https://bmtong.co.kr/partner/estimates/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 계산기 "법무통용 복사" 버튼이 만드는 순서와 동일해야 함 (채권 제외 7개, 이후 8번째 이름·9번째 적용세율·10번째 채권 실제 부담액)
    // 법무통 폼의 실제 항목명 표기: 법무사비용 -> 보수료, 부가세 -> 부가가치세
    const LABEL_ORDER = ['취득세', '지방교육세', '농어촌특별세', '인지대', '증지대', '보수료', '부가가치세'];

    // 이름(name)·적용세율(rateNote)은 계산기의 "법무통용 복사" 값(클립보드 8, 9번째 필드)에서 채워짐
    function buildMemoText(name, rateNote) {
        const greeting = name ? `안녕하세요, ${name}님. 최병섭 법무사 사무실입니다.` : '안녕하세요, 최병섭 법무사 사무실입니다.';
        const rateBlock = rateNote ? `■ ${name ? name + '님 ' : ''}적용 세율\n${rateNote}\n\n` : '';
        return `${greeting}

${rateBlock}■ 안내
· 잔금일 당일, 해당 부동산으로 방문합니다.
· 추가 비용은 없으며, 채권 금액만 당일 시세에 따라 소폭 변동될 수 있습니다.
· 견적 채택만으로는 예약되지 않습니다. (전화 또는 문자로 꼭! 연락 주세요.)

■ 진행 순서
① 서류 업로드 → ② 계약금 입금 → ③ 서류 검토·작업 → ④ 잔금일 등기 접수

■ 서류 업로드
https://registry-form-ten.vercel.app/
매매계약서, 부동산 거래신고필증을 올려주시면 서류 검토 및 작업에 들어갑니다.

■ 문의
홈페이지: https://choilaw.netlify.app/
전화: 010-3971-7708`;
    }

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

            // 채권: 항목명에 "채권"이 들어간 행에 실제 부담액(10번째 값)을 채운다. 값이 비어 있으면(시가표준액 미조회) 채우지 않는다
            const bondAmount = (values[9] || '').trim();
            let bondNote = '';
            if (bondAmount) {
                const bondNameInput = Array.from(nameInputs).find(el => el.value.includes('채권'));
                const bondRow = bondNameInput ? bondNameInput.parentElement : null;
                const bondInput = bondRow ? bondRow.querySelector('input[placeholder="금액"]') : null;
                if (bondInput) {
                    setReactInputValue(bondInput, bondAmount);
                    filled++;
                } else {
                    missing.push('채권');
                }
            } else {
                bondNote = '\n채권은 시가표준액이 조회되지 않아 채우지 않았습니다.';
            }

            const memoTextarea = document.querySelector('textarea[placeholder="고객에게 전달할 메모를 입력해주세요."]');
            if (memoTextarea) {
                const clientName = (values[7] || '').trim();
                const rateNote = (values[8] || '').trim();
                setReactInputValue(memoTextarea, buildMemoText(clientName, rateNote));
            }

            let msg = `${filled}개 항목을 채웠습니다.${bondNote}\n금액을 확인한 뒤 직접 제출해주세요.`;
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
