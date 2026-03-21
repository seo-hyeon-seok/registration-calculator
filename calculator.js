/**
 * 부동산 등기비용 견적 계산기
 * - 취득세, 국민주택채권, 등록면허세, 기타 비용 계산
 */

// ===== 상수 정의 =====

// 지역 분류 (광역시/특별시 vs 기타 지역)
const METRO_REGIONS = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan', 'sejong'];

// 도시철도채권 발행 지역 (해당 지역은 국민주택채권 대신 도시철도채권 매입)
const METRO_BOND_REGIONS = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon'];

// 주택 취득세율 (1주택 기준)
const HOUSING_TAX_RATES = {
    // 6억 이하: 1%
    // 6억~9억: (취득가액 × 2/3억 - 3) / 100
    // 9억 초과: 3%
    under6: 0.01,
    over9: 0.03
};

// 다주택자 취득세율 (조정지역)
const MULTI_HOUSE_TAX_RATES = {
    regulated: {
        2: 0.08,  // 2주택
        3: 0.12   // 3주택 이상
    },
    nonRegulated: {
        2: 0.01,  // 2주택 (일반세율)
        3: 0.08   // 3주택 이상
    }
};

// 토지/상가 취득세율
const PROPERTY_TAX_RATES = {
    land: {
        farm: 0.03,      // 농지
        general: 0.04    // 일반토지
    },
    commercial: 0.04     // 상가/오피스텔
};

// 국민주택채권 매입률 (서울/광역시)
const BOND_RATES_METRO = {
    housing: [
        { min: 0, max: 20000000, rate: 0 },           // 2천만 미만 면제
        { min: 20000000, max: 50000000, rate: 0.013 },
        { min: 50000000, max: 100000000, rate: 0.019 },
        { min: 100000000, max: 160000000, rate: 0.021 },
        { min: 160000000, max: 260000000, rate: 0.023 },
        { min: 260000000, max: 600000000, rate: 0.026 },
        { min: 600000000, max: Infinity, rate: 0.031 }
    ],
    land: [
        { min: 0, max: 5000000, rate: 0 },            // 500만 미만 면제
        { min: 5000000, max: 30000000, rate: 0.011 },
        { min: 30000000, max: 50000000, rate: 0.013 },
        { min: 50000000, max: 100000000, rate: 0.015 },
        { min: 100000000, max: Infinity, rate: 0.017 }
    ],
    commercial: [
        { min: 0, max: 10000000, rate: 0 },           // 1천만 미만 면제
        { min: 10000000, max: 50000000, rate: 0.012 },
        { min: 50000000, max: 100000000, rate: 0.014 },
        { min: 100000000, max: 300000000, rate: 0.016 },
        { min: 300000000, max: 500000000, rate: 0.018 },
        { min: 500000000, max: Infinity, rate: 0.020 }
    ]
};

// 국민주택채권 매입률 (기타 지역)
const BOND_RATES_OTHER = {
    housing: [
        { min: 0, max: 20000000, rate: 0 },
        { min: 20000000, max: 50000000, rate: 0.013 },
        { min: 50000000, max: 100000000, rate: 0.014 },
        { min: 100000000, max: 160000000, rate: 0.016 },
        { min: 160000000, max: 260000000, rate: 0.018 },
        { min: 260000000, max: 600000000, rate: 0.021 },
        { min: 600000000, max: Infinity, rate: 0.026 }
    ],
    land: [
        { min: 0, max: 5000000, rate: 0 },
        { min: 5000000, max: 30000000, rate: 0.009 },
        { min: 30000000, max: 50000000, rate: 0.011 },
        { min: 50000000, max: 100000000, rate: 0.013 },
        { min: 100000000, max: Infinity, rate: 0.015 }
    ],
    commercial: [
        { min: 0, max: 10000000, rate: 0 },
        { min: 10000000, max: 50000000, rate: 0.010 },
        { min: 50000000, max: 100000000, rate: 0.012 },
        { min: 100000000, max: 300000000, rate: 0.014 },
        { min: 300000000, max: 500000000, rate: 0.016 },
        { min: 500000000, max: Infinity, rate: 0.018 }
    ]
};

// 인지세 기준 (일반)
const STAMP_TAX = [
    { min: 0, max: 10000000, amount: 0 },                    // 1천만원 이하: 면제
    { min: 10000000, max: 30000000, amount: 20000 },         // 1천만원 초과~3천만원: 2만원
    { min: 30000000, max: 50000000, amount: 40000 },         // 3천만원 초과~5천만원: 4만원
    { min: 50000000, max: 100000000, amount: 70000 },        // 5천만원 초과~1억: 7만원
    { min: 100000000, max: 1000000000, amount: 150000 },     // 1억 초과~10억: 15만원
    { min: 1000000000, max: Infinity, amount: 350000 }       // 10억 초과: 35만원
];

// 플랫폼별 설정
const PLATFORM_CONFIG = {
    general: {
        name: '일반',
        registrationFee: 18000,      // 증지대
        transportFee: 70000,          // 교통비
        bondServiceFee: 40000,        // 채권 매입매도신청
        taxReportFee: 30000,          // 취득세 신고 납부
        submissionFee: 20000,         // 제출대행 및 우편료
        certFee: 20000                // 제증명료
    },
    master: {
        name: '등기마스터',
        registrationFee: 15000,
        transportFee: 0,
        bondServiceFee: 0,
        taxReportFee: 0,
        submissionFee: 0,
        certFee: 0
    },
    bubtong: {
        name: '법무통',
        registrationFee: 15000,
        transportFee: 0,
        bondServiceFee: 0,
        taxReportFee: 0,
        submissionFee: 0,
        certFee: 0
    }
};

// 등기마스터 매매가 구간별 기본 보수료 (부가세 포함)
// 5천원 단위로 조정 가능
const MASTER_FEE_TIERS = [
    { max:  300000000, fee: 210000 },  // ~3억
    { max:  500000000, fee: 250000 },  // ~5억
    { max:  700000000, fee: 280000 },  // ~7억
    { max:  900000000, fee: 330000 },  // ~9억
    { max: 1100000000, fee: 380000 },  // ~11억
    { max: 1300000000, fee: 420000 },  // ~13억
    { max: 1800000000, fee: 510000 },  // ~18억
    { max: 2400000000, fee: 550000 },  // ~24억
    { max: 3000000000, fee: 610000 },  // ~30억
];

// 등기마스터 지역별 가산금 (부가세 포함, 철산동 기준 거리)
const MASTER_REGION_SURCHARGE = {
    'gyeonggi_near':    0,     // 근거리: 광명,안양,시흥,부천
    'seoul_south':  30000,     // 중거리: 서울 전체
    'seoul_west':   30000,
    'seoul_central': 30000,
    'seoul_central_mid': 30000,
    'seoul_east':   30000,
    'seoul_north':  30000,
    'gyeonggi_mid': 50000,     // 원거리: 수원,분당,하남,고양,김포,성남,안산,인천,용인
};

// 서울 구 → 지역 코드 매핑 (주소검색 자동감지용)
const SEOUL_DISTRICT_TO_REGION = {
    '강서구': 'seoul_south', '구로구': 'seoul_south', '금천구': 'seoul_south',
    '양천구': 'seoul_south', '영등포구': 'seoul_south',
    '마포구': 'seoul_west', '서대문구': 'seoul_west', '용산구': 'seoul_west', '은평구': 'seoul_west',
    '강남구': 'seoul_central', '관악구': 'seoul_central', '동작구': 'seoul_central', '서초구': 'seoul_central',
    '종로구': 'seoul_central_mid', '중구': 'seoul_central_mid',
    '강동구': 'seoul_east', '광진구': 'seoul_east', '성동구': 'seoul_east', '송파구': 'seoul_east',
    '강북구': 'seoul_north', '노원구': 'seoul_north', '도봉구': 'seoul_north',
    '동대문구': 'seoul_north', '성북구': 'seoul_north', '중랑구': 'seoul_north',
};

// 등기마스터 지역 코드 → 표시명 매핑
const MASTER_REGION_LABEL = {
    'seoul_south': '서울남부',
    'seoul_west': '서울서부',
    'seoul_central': '서울중앙',
    'seoul_central_mid': '서울중앙중부',
    'seoul_east': '서울동부',
    'seoul_north': '서울북부',
    'gyeonggi_near': '경기 근거리',
    'gyeonggi_mid': '경기 중거리',
};

// 경기도 시 → 지역 코드 매핑 (주소검색 자동감지용)
const GYEONGGI_CITY_TO_REGION = {
    '광명시': 'gyeonggi_near', '안양시': 'gyeonggi_near', '시흥시': 'gyeonggi_near', '부천시': 'gyeonggi_near',
    '용인시': 'gyeonggi_mid', '수원시': 'gyeonggi_mid', '하남시': 'gyeonggi_mid',
    '고양시': 'gyeonggi_mid', '김포시': 'gyeonggi_mid', '성남시': 'gyeonggi_mid', '안산시': 'gyeonggi_mid',
};

// ===== 유틸리티 함수 =====

/**
 * 숫자를 한글로 변환
 */
function numberToKorean(num) {
    if (num === 0) return '영';

    const units = ['', '만', '억', '조'];
    const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const subUnits = ['', '십', '백', '천'];

    let result = '';
    let unitIndex = 0;

    while (num > 0) {
        const part = num % 10000;
        if (part > 0) {
            let partStr = '';
            let tempPart = part;
            let subIndex = 0;

            while (tempPart > 0) {
                const digit = tempPart % 10;
                if (digit > 0) {
                    if (subIndex === 0) {
                        partStr = digits[digit] + partStr;
                    } else {
                        partStr = (digit === 1 ? '' : digits[digit]) + subUnits[subIndex] + partStr;
                    }
                }
                tempPart = Math.floor(tempPart / 10);
                subIndex++;
            }

            result = partStr + units[unitIndex] + ' ' + result;
        }
        num = Math.floor(num / 10000);
        unitIndex++;
    }

    return result.trim() + '원';
}

/**
 * 숫자 포맷팅 (천단위 콤마)
 */
function formatNumber(num) {
    return new Intl.NumberFormat('ko-KR').format(Math.round(num));
}

/**
 * 입력값에서 숫자만 추출
 */
function parseInputNumber(str) {
    if (!str) return 0;
    return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

/**
 * 만원 단위로 반올림 (5천원 기준)
 */
function roundToTenThousand(num) {
    const remainder = num % 10000;
    if (remainder >= 5000) {
        return num - remainder + 10000;
    }
    return num - remainder;
}

// ===== 계산 함수 =====

/**
 * 취득세 계산
 */
function calculateAcquisitionTax(params) {
    const { propertyType, salePrice, houseCount, isRegulated, taxDiscountType, landType, isUnder85sqm } = params;

    let taxRate = 0;
    let ruralTaxRate = 0;          // 농어촌특별세
    let note = '';
    let isHousing = (propertyType === 'apartment');

    if (propertyType === 'apartment') {
        // 주택/아파트
        if (houseCount === 1 || !isRegulated) {
            // 1주택 또는 비조정지역
            if (salePrice <= 600000000) {
                taxRate = 0.01;
                note = '6억원 이하 1주택 기본세율 1% 적용';
            } else if (salePrice <= 900000000) {
                // 6억~9억: 누진세율 (소수점 넷째자리 반올림)
                taxRate = Math.round((salePrice * 2 / 300000000 - 3) * 100) / 10000;
                note = '6억~9억 구간 누진세율 적용';
            } else {
                taxRate = 0.03;
                note = '9억원 초과 세율 3% 적용';
            }

            // 감면 적용 표시 (12억 이하만 해당)
            if (salePrice <= 1200000000) {
                if (taxDiscountType === 'firstTime') {
                    note += ' (생애최초 감면 적용)';
                } else if (taxDiscountType === 'newborn') {
                    note += ' (신생아 감면 적용)';
                }
            }
        } else if (houseCount === 2 && isRegulated) {
            taxRate = 0.08;
            note = '조정지역 2주택 중과세율 8% 적용';
        } else {
            taxRate = 0.12;
            note = '3주택 이상 중과세율 12% 적용';
        }

        // 85㎡ 초과 주택은 농어촌특별세 부과
        if (!isUnder85sqm) {
            ruralTaxRate = 0.002;  // 0.2%
            note += ' (85㎡ 초과 농특세 부과)';
        }

    } else if (propertyType === 'land') {
        // 농지/토지
        if (landType === 'farm') {
            taxRate = 0.03;
            note = '농지 취득세율 3% 적용';
            ruralTaxRate = 0.002;
        } else {
            taxRate = 0.04;
            note = '일반토지 취득세율 4% 적용';
            ruralTaxRate = 0.002;
        }

    } else {
        // 상가/오피스텔
        taxRate = 0.04;
        note = '상가/오피스텔 취득세율 4% 적용';
        ruralTaxRate = 0.002;
    }

    // 취득세 계산
    let acquisitionTax = salePrice * taxRate;

    // 지방교육세 계산
    let educationTax;
    if (isHousing) {
        // 주택: 취득세 × 10%
        educationTax = acquisitionTax * 0.1;
    } else {
        // 비주택: 매매대금 × 0.4%
        educationTax = salePrice * 0.004;
    }

    // 농어촌특별세
    let ruralTax = salePrice * ruralTaxRate;

    // 감면 적용 (주택 1주택자만, 매매대금 12억 이하만 해당)
    let acquisitionDiscount = 0;
    let educationDiscount = 0;
    let discountLabel = '';
    if (propertyType === 'apartment' && houseCount === 1 && salePrice <= 1200000000) {
        if (taxDiscountType === 'firstTime') {
            // 생애최초 감면: 취득세 200만원, 교육세 20만원
            acquisitionDiscount = Math.min(acquisitionTax, 2000000);
            educationDiscount = Math.min(educationTax, 200000);
            discountLabel = '생애최초감면';
            acquisitionTax = Math.max(0, acquisitionTax - 2000000);
            educationTax = Math.max(0, educationTax - 200000);
        } else if (taxDiscountType === 'newborn') {
            // 신생아 감면: 취득세 500만원, 교육세 50만원
            acquisitionDiscount = Math.min(acquisitionTax, 5000000);
            educationDiscount = Math.min(educationTax, 500000);
            discountLabel = '신생아감면';
            acquisitionTax = Math.max(0, acquisitionTax - 5000000);
            educationTax = Math.max(0, educationTax - 500000);
        }
    }

    return {
        acquisitionTax: Math.round(acquisitionTax),
        educationTax: Math.round(educationTax),
        ruralTax: Math.round(ruralTax),
        total: Math.round(acquisitionTax) + Math.round(educationTax) + Math.round(ruralTax),
        taxRate,
        note,
        acquisitionDiscount,
        educationDiscount,
        discountLabel
    };
}

/**
 * 국민주택채권 매입액 계산
 */
function calculateBond(params) {
    const { propertyType, standardPrice, region, bondDiscountRate, buyerCount = 1 } = params;

    // 시가표준액이 없으면 채권 계산 건너뜀
    if (!standardPrice || standardPrice === 0) {
        return {
            bondAmount: 0,
            bondRate: 0,
            bondRatePercent: '0.00',
            discountAmount: 0,
            discountRate: bondDiscountRate,
            buyerCount: buyerCount
        };
    }

    const isMetro = region === 'metro';
    const bondRates = isMetro ? BOND_RATES_METRO : BOND_RATES_OTHER;

    let typeKey = propertyType;
    if (propertyType === 'apartment') typeKey = 'housing';

    const rates = bondRates[typeKey] || bondRates.commercial;

    // 공동명의: 시가표준액을 매수인 수로 나눠서 각각 계산
    const pricePerBuyer = standardPrice / buyerCount;

    // 1인당 시가표준액에 해당하는 매입률 찾기
    let bondRate = 0;
    for (const bracket of rates) {
        if (pricePerBuyer >= bracket.min && pricePerBuyer < bracket.max) {
            bondRate = bracket.rate;
            break;
        }
    }

    // 1인당 채권매입액 계산 (만원 단위 반올림)
    const bondAmountPerBuyer = roundToTenThousand(pricePerBuyer * bondRate);

    // 총 채권매입액 (1인당 × 매수인 수)
    const bondAmount = bondAmountPerBuyer * buyerCount;

    // 할인매도시 실제 부담액
    const discountRate = bondDiscountRate / 100;
    const actualCost = Math.round(bondAmount * discountRate);

    return {
        bondAmount,
        bondRate,
        bondRatePercent: (bondRate * 100).toFixed(2),
        discountAmount: actualCost,
        discountRate: bondDiscountRate,
        buyerCount: buyerCount,
        pricePerBuyer: pricePerBuyer,
        bondAmountPerBuyer: bondAmountPerBuyer
    };
}

/**
 * 인지세 계산
 * @param {number} salePrice - 매매대금
 * @param {string} propertyType - 부동산 유형 (apartment: 주거건물 1억 이하 면제)
 */
function calculateStampTax(salePrice, propertyType) {
    // 주거건물 이전시 매매대금 1억원 이하인 경우 인지면제
    if (propertyType === 'apartment' && salePrice <= 100000000) {
        return 0;
    }

    for (const bracket of STAMP_TAX) {
        if (salePrice > bracket.min && salePrice <= bracket.max) {
            return bracket.amount;
        }
    }
    // 1천만원 이하
    if (salePrice <= 10000000) {
        return 0;
    }
    return 350000; // 10억 초과
}

/**
 * 법무사 수수료 계산 (일반 플랫폼용 - 누진 계산)
 */
function calculateLawyerFeeGeneral(salePrice) {
    let fee = 0;

    if (salePrice <= 10000000) {
        fee = 100000;
    } else if (salePrice < 50000000) {
        fee = (salePrice - 10000000) * 0.0011 + 100000;
    } else if (salePrice < 100000000) {
        fee = (salePrice - 50000000) * 0.001 + 144000;
    } else if (salePrice < 300000000) {
        fee = (salePrice - 100000000) * 0.0009 + 194000;
    } else if (salePrice < 500000000) {
        fee = (salePrice - 300000000) * 0.0008 + 374000;
    } else if (salePrice < 1000000000) {
        fee = (salePrice - 500000000) * 0.0007 + 534000;
    } else if (salePrice < 2000000000) {
        fee = (salePrice - 1000000000) * 0.0005 + 884000;
    } else {
        fee = (salePrice - 2000000000) * 0.0004 + 1384000;
    }

    // 기본 수수료 66,000원 추가
    fee = Math.round(fee) + 66000;

    const baseFee = fee;
    const vat = Math.round(fee * 0.1);

    return {
        baseFee,
        vat,
        total: baseFee + vat
    };
}

/**
 * 법무통 보수료 구간 테이블 (부가세 포함 금액)
 * 실제 케이스 기반 — 데이터 추가 시 항목 추가/수정
 * [매매대금(원), 보수료(원)]
 */
const BUBTONG_FEE_TABLE = [
    [270000000,  210000],
    [320000000,  250000],
    [560000000,  250000],
    [665000000,  260000],
    [685000000,  270000],
    [730000000,  280000],
    [900000000,  330000],
    [1020000000, 360000],
    [1047000000, 370000],
    [1100000000, 380000],
    [1150000000, 385000],
    [1250000000, 405000],
    [1300000000, 415000],
    [1770000000, 510000],
    [2400000000, 550000],
];

/**
 * 법무사 수수료 계산 (법무통용 - 케이스 기반 보간 테이블)
 */
function calculateLawyerFeeBubtong(salePrice) {
    const table = BUBTONG_FEE_TABLE;
    let fee;

    if (salePrice <= table[0][0]) {
        // 최솟값 미만: 최소 보수료 고정
        fee = table[0][1];
    } else if (salePrice >= table[table.length - 1][0]) {
        // 최댓값 초과: 마지막 구간 비율로 연장
        const [p1, f1] = table[table.length - 2];
        const [p2, f2] = table[table.length - 1];
        const rate = (f2 - f1) / (p2 - p1);
        fee = Math.round(f2 + rate * (salePrice - p2));
    } else {
        // 구간 내: 선형 보간
        for (let i = 0; i < table.length - 1; i++) {
            const [p1, f1] = table[i];
            const [p2, f2] = table[i + 1];
            if (salePrice <= p2) {
                const ratio = (salePrice - p1) / (p2 - p1);
                fee = Math.round(f1 + ratio * (f2 - f1));
                break;
            }
        }
    }

    // fee는 부가세 포함 금액 → 역산으로 분리
    const total = fee;
    const baseFee = Math.round(fee / 1.1);
    const vat = total - baseFee;

    return {
        baseFee,      // 보수료 (부가세 제외)
        vat,          // 부가가치세
        total         // 합계 (부가세 포함)
    };
}

/**
 * 법무사 수수료 계산 (등기마스터용 - 법무통 동일 방식 × 10% 할인)
 */
function calculateLawyerFeeMaster(_masterRegion, salePrice) {
    // 법무통과 동일한 보간 테이블 사용
    const table = BUBTONG_FEE_TABLE;
    let fee;

    if (salePrice <= table[0][0]) {
        fee = table[0][1];
    } else if (salePrice >= table[table.length - 1][0]) {
        const [p1, f1] = table[table.length - 2];
        const [p2, f2] = table[table.length - 1];
        const rate = (f2 - f1) / (p2 - p1);
        fee = Math.round(f2 + rate * (salePrice - p2));
    } else {
        for (let i = 0; i < table.length - 1; i++) {
            const [p1, f1] = table[i];
            const [p2, f2] = table[i + 1];
            if (salePrice <= p2) {
                const ratio = (salePrice - p1) / (p2 - p1);
                fee = Math.round(f1 + ratio * (f2 - f1));
                break;
            }
        }
    }

    // 10% 할인 적용 (부가세 포함 금액 기준, 1000원 단위 반올림)
    const total = Math.round(fee * 0.9 / 1000) * 1000;
    const baseFee = Math.round(total / 1.1);
    const vat = total - baseFee;

    return {
        baseFee,      // 보수료 (부가세 제외)
        vat,          // 부가가치세
        total         // 합계 (부가세 포함)
    };
}

/**
 * 전체 비용 계산
 */
function calculateTotal(params) {
    const platform = params.platform || 'general';
    const config = PLATFORM_CONFIG[platform];

    const acquisitionResult = calculateAcquisitionTax(params);
    const bondResult = calculateBond(params);
    const stampTax = calculateStampTax(params.salePrice, params.propertyType);

    // 플랫폼별 법무사 수수료 계산
    let lawyerFeeResult;
    if (platform === 'general') {
        lawyerFeeResult = calculateLawyerFeeGeneral(params.salePrice);

        // 일반 플랫폼 할인율 적용 (법무사 비용만)
        const lawyerDiscount = params.lawyerDiscount || 0;
        if (lawyerDiscount > 0) {
            const discountRate = lawyerDiscount / 100;
            const originalFee = lawyerFeeResult.baseFee;
            const discountedFee = Math.round(originalFee * (1 - discountRate));
            const discountedVat = Math.round(discountedFee * 0.1);
            lawyerFeeResult = {
                baseFee: discountedFee,
                vat: discountedVat,
                total: discountedFee + discountedVat,
                originalFee: originalFee,
                discountRate: lawyerDiscount
            };
        }
    } else if (platform === 'master') {
        lawyerFeeResult = calculateLawyerFeeMaster(params.masterRegion, params.salePrice);
    } else {
        // 법무통 - 매매대금 기준
        lawyerFeeResult = calculateLawyerFeeBubtong(params.salePrice);
    }

    // 플랫폼별 고정 비용
    const registrationFee = config.registrationFee;
    const transportFee = params.transportFee || config.transportFee;

    // 일반 플랫폼 추가 비용
    const additionalFees = config.bondServiceFee + config.taxReportFee + config.submissionFee + config.certFee;

    const otherTotal = stampTax + registrationFee + transportFee + lawyerFeeResult.total + additionalFees;

    const grandTotal =
        acquisitionResult.total +
        bondResult.discountAmount +
        otherTotal;

    return {
        platform,
        salePrice: params.salePrice,
        acquisition: acquisitionResult,
        bond: bondResult,
        stampTax,
        registrationFee,
        transportFee,
        lawyerFee: lawyerFeeResult.baseFee,
        lawyerVat: lawyerFeeResult.vat,
        lawyerTotal: lawyerFeeResult.total,
        lawyerOriginalFee: lawyerFeeResult.originalFee || lawyerFeeResult.baseFee,
        lawyerDiscountRate: lawyerFeeResult.discountRate || 0,
        lawyerDiscountAmount: lawyerFeeResult.originalFee ? (lawyerFeeResult.originalFee - lawyerFeeResult.baseFee) : 0,
        additionalFees,
        bondServiceFee: config.bondServiceFee,
        taxReportFee: config.taxReportFee,
        submissionFee: config.submissionFee,
        certFee: config.certFee,
        otherTotal,
        grandTotal
    };
}

// ===== UI 제어 =====

document.addEventListener('DOMContentLoaded', function() {
    // 요소 참조
    const propertyTypeBtns = document.querySelectorAll('.property-type-btn');
    const housingOptions = document.getElementById('housingOptions');
    const landOptions = document.getElementById('landOptions');
    const sectionNumber = document.getElementById('sectionNumber');
    const salePriceInput = document.getElementById('salePrice');
    const standardPriceInput = document.getElementById('standardPrice');
    const bondRateInput = document.getElementById('bondRate');
    const calculateBtn = document.getElementById('calculateBtn');
    const resultSection = document.getElementById('resultSection');

    let currentPropertyType = 'apartment';
    let currentPlatform = 'general';

    // 플랫폼 선택
    const platformBtns = document.querySelectorAll('.platform-btn');
    const lawyerDiscountGroup = document.getElementById('lawyerDiscountGroup');

    platformBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            platformBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentPlatform = this.dataset.platform;

            // 플랫폼에 따른 기본값 설정
            const config = PLATFORM_CONFIG[currentPlatform];
            const transportFeeInput = document.getElementById('transportFee');
            if (transportFeeInput) {
                if (currentPlatform === 'master') {
                    transportFeeInput.value = '0';
                    transportFeeInput.disabled = false;
                } else {
                    transportFeeInput.value = formatNumber(config.transportFee);
                    transportFeeInput.disabled = false;
                }
            }

            // 일반 플랫폼일 때만 할인율 옵션 표시
            if (lawyerDiscountGroup) {
                lawyerDiscountGroup.style.display = currentPlatform === 'general' ? 'block' : 'none';
            }

        });
    });

    // 주소 검색 버튼
    const searchAddressBtn = document.getElementById('searchAddressBtn');
    const addressInput = document.getElementById('address');
    const regionRadios = document.querySelectorAll('input[name="region"]');

    if (searchAddressBtn) {
        searchAddressBtn.addEventListener('click', function() {
            // daum API 로드 확인
            if (typeof daum === 'undefined' || typeof daum.Postcode === 'undefined') {
                alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
                return;
            }

            new daum.Postcode({
                oncomplete: function(data) {
                    // 도로명 주소 또는 지번 주소
                    let fullAddress = data.address;

                    // 상세주소가 있으면 추가
                    if (data.buildingName) {
                        fullAddress += ' (' + data.buildingName + ')';
                    }

                    addressInput.value = fullAddress;

                    // 지역 자동 선택 (특별시/광역시 vs 기타지역)
                    const sido = data.sido;
                    const metroList = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'];
                    const isMetro = metroList.some(metro => sido.includes(metro));

                    regionRadios.forEach(radio => {
                        if (isMetro && radio.value === 'metro') {
                            radio.checked = true;
                        } else if (!isMetro && radio.value === 'other') {
                            radio.checked = true;
                        }
                    });


                }
            }).open();
        });
    }

    // 주소 직접 입력 시 지역 자동 감지
    if (addressInput) {
        addressInput.addEventListener('input', function() {
            const addr = this.value;

            // 서울 구 이름 포함 여부 먼저 확인 (서울 없이 구 이름만 입력해도 서울로 판단)
            const isSeoulDistrict = Object.keys(SEOUL_DISTRICT_TO_REGION).some(d => addr.includes(d));

            // 특별·광역시 여부 자동 감지 (모든 플랫폼 공통)
            const metroNames = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'];
            const isMetro = isSeoulDistrict || metroNames.some(m => addr.includes(m));
            regionRadios.forEach(radio => {
                if (isMetro && radio.value === 'metro') radio.checked = true;
                else if (!isMetro && radio.value === 'other') radio.checked = true;
            });


        });
    }

    // 부동산 유형 선택
    propertyTypeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            propertyTypeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentPropertyType = this.dataset.type;

            // 옵션 섹션 표시/숨김
            housingOptions.classList.toggle('hidden', currentPropertyType !== 'apartment');
            landOptions.classList.toggle('hidden', currentPropertyType !== 'land');

            // 섹션 번호 업데이트
            sectionNumber.textContent = (currentPropertyType === 'apartment' || currentPropertyType === 'land') ? '4' : '3';
        });
    });

    // 금액 입력 시 한글 변환 및 포맷팅
    function handlePriceInput(input, koreanSpan) {
        input.addEventListener('input', function() {
            const value = parseInputNumber(this.value);
            if (value > 0) {
                this.value = formatNumber(value);
                document.getElementById(koreanSpan).textContent = numberToKorean(value);
            } else {
                document.getElementById(koreanSpan).textContent = '';
            }
        });
    }

    handlePriceInput(salePriceInput, 'salePriceKorean');
    handlePriceInput(standardPriceInput, 'standardPriceKorean');

    // 매매대금 12억 초과 시 감면 안내 메세지 표시
    const taxDiscountLimitNotice = document.getElementById('taxDiscountLimitNotice');
    if (salePriceInput && taxDiscountLimitNotice) {
        salePriceInput.addEventListener('input', function() {
            const price = parseInputNumber(this.value);
            taxDiscountLimitNotice.style.display = price > 1200000000 ? 'block' : 'none';
        });
    }

    // 계산 함수
    function doCalculate() {
        const salePrice = parseInputNumber(salePriceInput.value);
        const standardPrice = parseInputNumber(standardPriceInput.value);
        const bondDiscountRate = parseFloat(bondRateInput.value) || 4.5;

        if (salePrice === 0) {
            alert('매매대금을 입력해주세요.');
            salePriceInput.focus();
            return;
        }

        // 시가표준액이 없으면 채권 계산 건너뜀 (선택 사항)

        // 파라미터 수집
        const houseCountRadio = document.querySelector('input[name="houseCount"]:checked');
        const regulatedRadio = document.querySelector('input[name="regulated"]:checked');
        const landTypeRadio = document.querySelector('input[name="landType"]:checked');
        const taxDiscountRadio = document.querySelector('input[name="taxDiscount"]:checked');

        const regionRadio = document.querySelector('input[name="region"]:checked');
        const under85sqmCheckbox = document.getElementById('under85sqm');

        const transportFeeInput = document.getElementById('transportFee');
        const defaultTransportFee = PLATFORM_CONFIG[currentPlatform].transportFee;
        const transportFee = parseInputNumber(transportFeeInput.value) || (currentPlatform === 'master' ? 0 : defaultTransportFee);

        const buyerCountInput = document.getElementById('buyerCount');
        const buyerCount = parseInt(buyerCountInput.value) || 1;

        const lawyerDiscountRadio = document.querySelector('input[name="lawyerDiscount"]:checked');
        const lawyerDiscount = lawyerDiscountRadio ? parseInt(lawyerDiscountRadio.value) : 0;

        const params = {
            platform: currentPlatform,
            lawyerDiscount: lawyerDiscount,
            propertyType: currentPropertyType,
            salePrice: salePrice,
            standardPrice: standardPrice,
            region: regionRadio ? regionRadio.value : 'other',
            houseCount: houseCountRadio ? parseInt(houseCountRadio.value) : 1,
            isRegulated: regulatedRadio ? regulatedRadio.value === 'yes' : false,
            taxDiscountType: taxDiscountRadio ? taxDiscountRadio.value : 'none',
            isUnder85sqm: under85sqmCheckbox ? under85sqmCheckbox.checked : true,
            landType: landTypeRadio ? landTypeRadio.value : 'general',
            bondDiscountRate: bondDiscountRate,
            transportFee: transportFee,
            buyerCount: buyerCount
        };

        // 계산 실행
        const result = calculateTotal(params);

        // 결과 표시
        displayResults(result);

        // 결과 섹션 표시 및 스크롤
        resultSection.classList.remove('hidden');
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 계산 버튼 클릭 이벤트
    calculateBtn.addEventListener('click', doCalculate);

    // 결과 표시 함수
    let lastResult = null;

    function displayResults(result) {
        lastResult = result;

        // 취득세
        document.getElementById('acquisitionTax').textContent = formatNumber(result.acquisition.acquisitionTax) + '원';
        document.getElementById('educationTax').textContent = formatNumber(result.acquisition.educationTax) + '원';
        document.getElementById('ruralTax').textContent = formatNumber(result.acquisition.ruralTax) + '원';
        document.getElementById('acquisitionTaxTotal').textContent = formatNumber(result.acquisition.total) + '원';
        const taxNoteEl = document.getElementById('taxNote');
        const taxDiscountRadio = document.querySelector('input[name="taxDiscount"]:checked');
        let taxNoteHtml = result.acquisition.note || '';
        if (taxDiscountRadio && taxDiscountRadio.value !== 'none' && result.salePrice > 1200000000) {
            const discountLabel = taxDiscountRadio.value === 'firstTime' ? '생애최초감면' : '신생아감면';
            const noticeText = `※ 매매대금 12억 초과로 ${discountLabel}이 적용되지 않았습니다.`;
            taxNoteHtml += (taxNoteHtml ? ' ' : '') + `<span style="color:#e53935;">${noticeText}</span>`;
        }
        taxNoteEl.innerHTML = taxNoteHtml;

        // 국민주택채권
        document.getElementById('bondAmount').textContent = formatNumber(result.bond.bondAmount) + '원';
        document.getElementById('bondRate2').textContent = result.bond.bondRatePercent + '%';
        document.getElementById('bondDiscount').textContent = formatNumber(result.bond.discountAmount) + '원';
        document.getElementById('bondTotal').textContent = formatNumber(result.bond.discountAmount) + '원';

        // 기타 비용
        document.getElementById('stampTax').textContent = formatNumber(result.stampTax) + '원';
        document.getElementById('registrationFee').textContent = formatNumber(result.registrationFee) + '원';
        document.getElementById('transportFeeResult').textContent = formatNumber(result.transportFee) + '원';
        const transportFeeRow = document.getElementById('transportFeeRow');
        if (transportFeeRow) {
            transportFeeRow.style.display = 'flex';
        }
        const lawyerFeeLabel = document.getElementById('lawyerFeeLabel');
        if (lawyerFeeLabel) {
            lawyerFeeLabel.textContent = '보수료';
        }

        // 할인 적용 시 원래 금액 표시, 아니면 할인된 금액 표시
        if (result.lawyerDiscountRate > 0) {
            document.getElementById('lawyerFee').textContent = formatNumber(result.lawyerOriginalFee) + '원';
            document.getElementById('lawyerDiscountRow').style.display = 'flex';
            document.getElementById('lawyerDiscountLabel').textContent = '할인 -' + result.lawyerDiscountRate + '%';
            document.getElementById('lawyerDiscountAmount').textContent = '-' + formatNumber(result.lawyerDiscountAmount) + '원';
            document.getElementById('lawyerDiscountedFeeRow').style.display = 'flex';
            document.getElementById('lawyerDiscountedFee').textContent = formatNumber(result.lawyerFee) + '원';
        } else {
            document.getElementById('lawyerFee').textContent = formatNumber(result.lawyerFee) + '원';
            document.getElementById('lawyerDiscountRow').style.display = 'none';
            document.getElementById('lawyerDiscountedFeeRow').style.display = 'none';
        }
        document.getElementById('lawyerVat').textContent = formatNumber(result.lawyerVat) + '원';
        document.getElementById('otherTotal').textContent = formatNumber(result.otherTotal) + '원';

        // 일반 플랫폼 추가 비용 표시/숨김
        const isGeneral = result.platform === 'general';
        document.getElementById('bondServiceFeeRow').style.display = isGeneral ? 'flex' : 'none';
        document.getElementById('taxReportFeeRow').style.display = isGeneral ? 'flex' : 'none';
        document.getElementById('submissionFeeRow').style.display = isGeneral ? 'flex' : 'none';
        document.getElementById('certFeeRow').style.display = isGeneral ? 'flex' : 'none';

        if (isGeneral) {
            document.getElementById('bondServiceFee').textContent = formatNumber(result.bondServiceFee) + '원';
            document.getElementById('taxReportFee').textContent = formatNumber(result.taxReportFee) + '원';
            document.getElementById('submissionFee').textContent = formatNumber(result.submissionFee) + '원';
            document.getElementById('certFee').textContent = formatNumber(result.certFee) + '원';
        }

        // 총 비용
        document.getElementById('grandTotal').textContent = formatNumber(result.grandTotal) + '원';
        document.getElementById('summaryTax').textContent = formatNumber(result.acquisition.total) + '원';
        document.getElementById('summaryBond').textContent = formatNumber(result.bond.discountAmount) + '원';
        document.getElementById('summaryOther').textContent = formatNumber(result.otherTotal) + '원';
    }

    // 복사 버튼 이벤트
    const copyAllBtn = document.getElementById('copyAllBtn');
    const copyForMasterBtn = document.getElementById('copyForMasterBtn');

    if (copyAllBtn) {
        copyAllBtn.addEventListener('click', function() {
            if (!lastResult) return;

            const text = `[등기비용 견적]

취득세: ${formatNumber(lastResult.acquisition.acquisitionTax)}원
지방교육세: ${formatNumber(lastResult.acquisition.educationTax)}원
농어촌특별세: ${formatNumber(lastResult.acquisition.ruralTax)}원
소계: ${formatNumber(lastResult.acquisition.total)}원

국민주택채권 매입액: ${formatNumber(lastResult.bond.bondAmount)}원
채권 할인부담금: ${formatNumber(lastResult.bond.discountAmount)}원

인지대: ${formatNumber(lastResult.stampTax)}원
증지대: ${formatNumber(lastResult.registrationFee)}원
일당 및 교통비: ${formatNumber(lastResult.transportFee)}원
보수료: ${formatNumber(lastResult.lawyerFee)}원
부가가치세: ${formatNumber(lastResult.lawyerVat)}원

총 등기비용: ${formatNumber(lastResult.grandTotal)}원`;

            navigator.clipboard.writeText(text).then(() => {
                copyAllBtn.textContent = '복사 완료!';
                copyAllBtn.classList.add('copied');
                setTimeout(() => {
                    copyAllBtn.textContent = '전체 결과 복사';
                    copyAllBtn.classList.remove('copied');
                }, 2000);
            });
        });
    }

    if (copyForMasterBtn) {
        copyForMasterBtn.addEventListener('click', function() {
            if (!lastResult) return;

            // 등기마스터 형식에 맞춘 데이터 (숫자만 탭으로 구분)
            // 순서: 취득세, 지방교육세, 농어촌특별세, 인지대, 증지대, 보수료, 부가가치세
            const values = [
                lastResult.acquisition.acquisitionTax,
                lastResult.acquisition.educationTax,
                lastResult.acquisition.ruralTax,
                lastResult.stampTax,
                lastResult.registrationFee,
                lastResult.lawyerFee,
                lastResult.lawyerVat
            ];

            const text = values.join('\t');

            navigator.clipboard.writeText(text).then(() => {
                copyForMasterBtn.textContent = '복사 완료!';
                copyForMasterBtn.classList.add('copied');
                setTimeout(() => {
                    copyForMasterBtn.textContent = '등기마스터용 복사';
                    copyForMasterBtn.classList.remove('copied');
                }, 2000);
            });
        });
    }

    // 영수증 출력 (새 창 인쇄)
    const printReceiptBtn = document.getElementById('printReceiptBtn');
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', function() {
            if (!lastResult) return;

            const r = lastResult;
            const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
            const address = document.getElementById('address').value || '-';
            const caseName = document.getElementById('caseName').value || '소유권이전';
            const standardPriceVal = parseInputNumber(document.getElementById('standardPrice').value);


            const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>등기비용 견적서</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Pretendard', -apple-system, sans-serif; color: #2c2416; background: #fff; padding: 8mm 10mm; font-size: 13px; line-height: 1.5; }
  h1 { text-align:center; font-size:20px; letter-spacing:2px; color:#3d3229; padding-bottom:3mm; border-bottom:2px solid #3d3229; margin-bottom:3mm; }
  .date { text-align:center; font-size:12px; color:#8b7355; margin-bottom:3mm; }
  table { width:100%; border-collapse:collapse; margin-bottom:3mm; }
  .info-table td { padding:3px 6px; font-size:13px; }
  .info-table td.label { background:#f5f0e8; color:#6b5d4d; font-weight:600; width:18%; }
  .section-title { background:#3d3229; color:#fff; padding:7px 8px; font-size:13px; font-weight:600; border-radius:3px 3px 0 0; margin-bottom:0; }
  .detail-table { border:1px solid #e0d6c8; border-top:none; }
  .detail-table td { padding:4px 8px; }
  .detail-table tr.subtotal td { background:#faf7f2; font-weight:600; }
  .detail-table td.right { text-align:right; }
  .detail-table td.label { color:#6b5d4d; }
  .total-bar { background:#3d3229; color:#fff; border-radius:4px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:2mm; }
  .total-bar .amount { color:#f5c842; font-size:17px; font-weight:700; }
  .summary { display:flex; gap:0; font-size:12px; color:#6b5d4d; border:1px solid #e0d6c8; border-radius:3px; margin-bottom:3mm; }
  .summary div { flex:1; padding:3px 6px; text-align:center; border-right:1px solid #e0d6c8; }
  .summary div:last-child { border-right:none; }
  .summary .val { font-weight:600; color:#3d3229; font-size:13px; }
  .note { font-size:13px; font-weight:600; color:#8b7355; padding:2px 4px; }
  .disclaimer { margin-top:3mm; padding:3px 6px; background:#f5f0e8; border-left:3px solid #8b7355; font-size:11px; color:#8b7355; line-height:1.5; }
  @media print { @page { margin: 0; } body { padding: 8mm 10mm; } }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head>
<body>
  <h1>부동산 등기비용 견적서</h1>
  <div class="date">${today}</div>

  <table class="info-table">
    <tr>
      <td class="label">사건명</td><td>${caseName}</td>
      <td class="label">매매대금</td><td><strong>${formatNumber(r.salePrice)}원</strong></td>
    </tr>
    <tr>
      <td class="label">과세표준액</td><td colspan="3">${standardPriceVal > 0 ? formatNumber(standardPriceVal) + '원' : '-'}</td>
    </tr>
    <tr>
      <td class="label">주소</td><td colspan="3">${address}</td>
    </tr>
  </table>

  <div class="section-title">취득세 및 등기신청 관련</div>
  <table class="detail-table">
    <tr><td class="label" style="border-bottom:1px solid #e0d6c8;">취득세${r.acquisition.acquisitionDiscount > 0 ? ` <span style="color:#c0392b;font-size:11px;">(${r.acquisition.discountLabel} -${formatNumber(r.acquisition.acquisitionDiscount)}원 적용)</span>` : ''}</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.acquisition.acquisitionTax)}원</td></tr>
    <tr><td class="label" style="border-bottom:1px solid #e0d6c8;">지방교육세${r.acquisition.educationDiscount > 0 ? ` <span style="color:#c0392b;font-size:11px;">(${r.acquisition.discountLabel} -${formatNumber(r.acquisition.educationDiscount)}원 적용)</span>` : ''}</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.acquisition.educationTax)}원</td></tr>
    ${r.acquisition.ruralTax > 0 ? `<tr><td class="label" style="border-bottom:1px solid #e0d6c8;">농어촌특별세</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.acquisition.ruralTax)}원</td></tr>` : ''}
    ${r.stampTax > 0 ? `<tr><td class="label" style="border-bottom:1px solid #e0d6c8;">인지대</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.stampTax)}원</td></tr>` : ''}
    ${r.registrationFee > 0 ? `<tr><td class="label" style="border-bottom:1px solid #e0d6c8;">증지대</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.registrationFee)}원</td></tr>` : ''}
    ${r.taxReportFee > 0 ? `<tr><td class="label" style="border-bottom:1px solid #e0d6c8;">취득세 신고 납부</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.taxReportFee)}원</td></tr>` : ''}
    ${r.certFee > 0 ? `<tr><td class="label" style="border-bottom:1px solid #e0d6c8;">제증명료</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.certFee)}원</td></tr>` : ''}
    <tr class="subtotal"><td>소계</td><td class="right">${formatNumber(r.acquisition.total + r.stampTax + r.registrationFee + r.taxReportFee + r.certFee)}원</td></tr>
  </table>
  ${r.acquisition.note ? `<div class="note">${r.acquisition.note}</div>` : ''}

  <div class="section-title" style="margin-top:3mm;">국민주택채권</div>
  <table class="detail-table">
    <tr><td class="label" style="border-bottom:1px solid #e0d6c8;">채권매입액</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.bond.bondAmount)}원</td></tr>
    ${r.bondServiceFee > 0 ? `<tr><td class="label" style="border-bottom:1px solid #e0d6c8;">채권 매입매도신청</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.bondServiceFee)}원</td></tr>` : ''}
    <tr class="subtotal"><td>실부담액 (할인매도) ${r.bond.discountRate}%</td><td class="right">${formatNumber(r.bond.discountAmount + r.bondServiceFee)}원</td></tr>
  </table>

  <div class="section-title" style="margin-top:3mm;">보수료 및 기타비용</div>
  <table class="detail-table">
    ${r.lawyerFee > 0 ? `<tr><td class="label" style="border-bottom:1px solid #e0d6c8;">보수료</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.lawyerFee)}원</td></tr>` : ''}
    ${r.lawyerVat > 0 ? `<tr><td class="label" style="border-bottom:1px solid #e0d6c8;">부가가치세</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.lawyerVat)}원</td></tr>` : ''}
    ${r.transportFee > 0 ? `<tr><td class="label" style="border-bottom:1px solid #e0d6c8;">일당 및 교통비</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.transportFee)}원</td></tr>` : ''}
    ${r.submissionFee > 0 ? `<tr><td class="label" style="border-bottom:1px solid #e0d6c8;">제출대행 및 우편료</td><td class="right" style="border-bottom:1px solid #e0d6c8;">${formatNumber(r.submissionFee)}원</td></tr>` : ''}
    <tr class="subtotal"><td>소계</td><td class="right">${formatNumber(r.lawyerFee + r.lawyerVat + r.transportFee + r.submissionFee)}원</td></tr>
  </table>

  <div style="margin-top:3mm;">
    <div class="total-bar">
      <span>총 등기비용</span>
      <span class="amount">${formatNumber(r.grandTotal)}원</span>
    </div>
    <div class="summary">
      <div>취득세 및 등기신청<br><span class="val">${formatNumber(r.acquisition.total + r.stampTax + r.registrationFee + r.taxReportFee + r.certFee)}원</span></div>
      <div>채권 실부담금<br><span class="val">${formatNumber(r.bond.discountAmount + r.bondServiceFee)}원</span></div>
      <div>보수료 및 기타<br><span class="val">${formatNumber(r.lawyerFee + r.lawyerVat + r.transportFee + r.submissionFee)}원</span></div>
    </div>
  </div>

  <div class="disclaimer">※ 본 견적서는 예상 금액이며 실제 비용과 차이가 있을 수 있습니다.</div>
</body>
</html>`;

            const win = window.open('', '_blank');
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => { win.print(); }, 500);
        });
    }

    // 일당 및 교통비 입력 포맷팅
    const transportFeeInput = document.getElementById('transportFee');
    if (transportFeeInput) {
        transportFeeInput.addEventListener('input', function() {
            const value = parseInputNumber(this.value);
            if (value > 0) {
                this.value = formatNumber(value);
            }
        });
    }

    // 시가표준액 찾기 버튼
    const searchStandardPriceBtn = document.getElementById('searchStandardPriceBtn');
    if (searchStandardPriceBtn) {
        searchStandardPriceBtn.addEventListener('click', function() {
            window.open('https://www.realtyprice.kr/notice/town/nfSiteLink.htm', '_blank');
        });
    }

    // 채권할인율 찾기 버튼
    const searchBondRateBtn = document.getElementById('searchBondRateBtn');
    if (searchBondRateBtn) {
        searchBondRateBtn.addEventListener('click', function() {
            window.open('http://www.n6104.co.kr/index.asp', '_blank');
        });
    }
});
