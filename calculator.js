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

// 등기마스터 매매가 구간별 기본 보수료
// vatIncluded: true → fee가 부가세 포함 금액, false → fee가 부가세 별도 금액
const MASTER_FEE_TIERS = [
    { max:  600000000, fee: 250000, vatIncluded: true },  // ~6억   (부가세 포함)
    { max:  800000000, fee: 265000, vatIncluded: true },  // ~8억   (부가세 포함)
    { max: 1000000000, fee: 280000, vatIncluded: true },  // ~10억  (부가세 포함)
    { max: 1300000000, fee: 295000, vatIncluded: true },  // ~13억  (부가세 포함)
    { max: 1600000000, fee: 310000, vatIncluded: true },  // ~16억  (부가세 포함)
    { max: 1800000000, fee: 330000, vatIncluded: true },  // ~18억  (부가세 포함)
    { max: 2000000000, fee: 350000, vatIncluded: true },  // ~20억  (부가세 포함)
    { max: 2500000000, fee: 370000, vatIncluded: true },  // ~25억  (부가세 포함)
    { max: 3000000000, fee: 390000, vatIncluded: true },  // ~30억  (부가세 포함)
    { max: Infinity,   fee: 410000, vatIncluded: true },  // 30억~  (부가세 포함)
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

    // 농어촌특별세 (엑셀 공식: =IF(AC21, IF(감면없음, ROUNDDOWN(Y7*0.02*0.1,-1), ROUNDDOWN(H12*(2/V16/100)*0.1,-1)+감면세액*0.2), ""))
    let ruralTax = 0;
    if (ruralTaxRate > 0) {
        if (acquisitionDiscount > 0 && !isUnder85sqm) {
            // 감면 + 85㎡ 초과: 감면 후 취득세(H12) 기준 농특세 + 감면세액의 20%
            const baseRuralTax = Math.floor(acquisitionTax * 0.002 / taxRate / 10) * 10;
            ruralTax = baseRuralTax + acquisitionDiscount * 0.2;
        } else {
            // 일반: ROUNDDOWN(매매대금 × 0.2%, -1)
            ruralTax = Math.floor(salePrice * ruralTaxRate / 10) * 10;
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
    const { propertyType, standardPrice, region, bondDiscountRate, buyerCount = 1, buyerShares = [] } = params;

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

    // 지분별 채권 계산 함수
    function bondForPrice(price) {
        let rate = 0;
        for (const bracket of rates) {
            if (price >= bracket.min && price < bracket.max) {
                rate = bracket.rate;
                break;
            }
        }
        return { amount: roundToTenThousand(price * rate), rate };
    }

    let bondAmount = 0;
    let bondRate = 0;

    if (buyerCount >= 2 && buyerShares.length === buyerCount) {
        // 각 매수인 지분에 따라 과세표준 분할 후 개별 계산
        for (const share of buyerShares) {
            const ratio = share.denominator > 0 ? share.numerator / share.denominator : 1 / buyerCount;
            const priceForBuyer = standardPrice * ratio;
            const result = bondForPrice(priceForBuyer);
            bondAmount += result.amount;
        }
        // 표시용 대표 요율 (1인 기준)
        bondRate = bondForPrice(standardPrice * (buyerShares[0].denominator > 0 ? buyerShares[0].numerator / buyerShares[0].denominator : 1 / buyerCount)).rate;
    } else {
        // 1인 또는 지분 미입력: 균등 분할
        const pricePerBuyer = standardPrice / buyerCount;
        const result = bondForPrice(pricePerBuyer);
        bondAmount = result.amount * buyerCount;
        bondRate = result.rate;
    }

    // 할인매도시 실제 부담액
    const discountRate = bondDiscountRate / 100;
    const actualCost = Math.round(bondAmount * discountRate);

    return {
        bondAmount,
        bondRate,
        bondRatePercent: (bondRate * 100).toFixed(2),
        discountAmount: actualCost,
        discountRate: bondDiscountRate,
        buyerCount: buyerCount
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
 * 법무통 최소 보수료 산정 기준표 (부가세 별도 금액)
 * 출처: bmtong.co.kr 프론트엔드 번들(PartnerEstimateDetail)의 최소 보수료 검증 로직을 그대로 이식
 * [선택구간 하한, 선택구간 상한, 기준액, 차감기준값, 요율]
 */
const BUBTONG_BASE_FEE_TABLE = [
    [10000000,    60000000,    100000,   10000000,    0.0011],
    [60000000,    110000000,   144000,   50000000,    0.0010],
    [110000000,   300000000,   194000,   100000000,   0.0009],
    [300000000,   510000000,   374000,   300000000,   0.0008],
    [510000000,   1100000000,  534000,   500000000,   0.0007],
    [1100000000,  2100000000,  884000,   1000000000,  0.0005],
    [2100000000,  21000000000, 1384000,  2000000000,  0.0004],
    [21000000000, Infinity,    8584000,  20000000000, 0.0001],
];

// 표준 보수료(N) = 기준액 + (거래금액 - 차감기준값) × 요율
function bubtongStandardFee(salePrice) {
    const row = BUBTONG_BASE_FEE_TABLE.find(([low, high]) => salePrice >= low && salePrice < high);
    if (!row) return 0;
    const [, , base, ke, rate] = row;
    return base + (salePrice - ke) * rate;
}

// 구간별 할인율(소수) 또는 고정 보수료(1보다 큰 정수)
function bubtongDiscountFactor(salePrice) {
    if (salePrice >= 10000000 && salePrice < 300000000) return 0.6;
    if (salePrice >= 300000000 && salePrice < 640000000) return 250000;
    if (salePrice >= 640000000 && salePrice < 2100000000) return 0.4;
    if (salePrice >= 2100000000 && salePrice < 4000000000) return 550000;
    if (salePrice >= 4000000000) return 0.3;
    return 0;
}

// 1,000원 단위 올림 (사이트가 요구하는 최소 보수료 이상이 되도록 보수적으로 절상)
function bubtongRoundUp(value) {
    return Math.ceil(value / 1000) * 1000;
}

/**
 * 법무사 수수료 계산 (법무통용 - 사이트 최소 보수료 산식 그대로 이식)
 */
function calculateLawyerFeeBubtong(salePrice) {
    let baseFee;
    if (salePrice <= 10000000) {
        // 거래금액 1천만원 이하: 최소 보수료 고정
        baseFee = 70000;
    } else {
        const factor = bubtongDiscountFactor(salePrice);
        baseFee = factor > 1 ? factor : bubtongRoundUp(bubtongStandardFee(salePrice) * factor);
    }

    // fee는 부가세 별도 금액(보수료) → 부가세 10% 추가 (2026-07-30 정책 변경)
    const vat = Math.round(baseFee * 0.1);
    const total = baseFee + vat;

    return {
        baseFee,      // 보수료 (부가세 제외)
        vat,          // 부가가치세
        total         // 합계 (부가세 포함)
    };
}

/**
 * 법무사 수수료 계산 (등기마스터용 - 구간별 고정 보수료)
 */
function calculateLawyerFeeMaster(_masterRegion, salePrice) {
    // 구간별 고정 보수료
    const tier = MASTER_FEE_TIERS.find(t => salePrice <= t.max) ?? MASTER_FEE_TIERS[MASTER_FEE_TIERS.length - 1];
    let baseFee, vat, total;
    if (tier.vatIncluded) {
        // 부가세 포함 금액 → 역산
        total = tier.fee;
        baseFee = Math.round(total / 1.1);
        vat = total - baseFee;
    } else {
        // 부가세 별도 금액 → 10% 추가
        baseFee = tier.fee;
        vat = Math.round(baseFee * 0.1);
        total = baseFee + vat;
    }

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

    // 플랫폼별 고정 비용 (다대사건이면 증지대 2배)
    const registrationFee = config.registrationFee * (params.isDadae ? 2 : 1);
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

    // 플랫폼 레이블 매핑
    const PLATFORM_LABEL = { general: '일반', master: '등기마스터', bubtong: '법무통' };

    // 사건명에 플랫폼 접미사 반영 (기존 접미사 제거 후 재부착)
    function updateCaseNamePlatform(platform) {
        const caseNameInput = document.getElementById('caseName');
        if (!caseNameInput) return;
        // 기존 " (xxx)" 접미사 제거
        const base = caseNameInput.value.replace(/\s*\([^)]*\)$/, '').trim();
        caseNameInput.value = base + ' (' + PLATFORM_LABEL[platform] + ')';
    }

    // 초기 사건명에 기본 플랫폼(일반) 반영
    updateCaseNamePlatform(currentPlatform);

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

            // 사건명 플랫폼 접미사 업데이트
            updateCaseNamePlatform(currentPlatform);
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

        // 공동명의 지분 수집 (% → 비율)
        const buyerShares = [];
        if (buyerCount >= 2) {
            for (let i = 0; i < buyerCount; i++) {
                const pctEl = document.getElementById(`buyerShare_pct_${i}`);
                const pct = pctEl ? (parseFloat(pctEl.value) || 0) : (100 / buyerCount);
                buyerShares.push({ numerator: pct, denominator: 100 });
            }
        }

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
            buyerCount: buyerCount,
            buyerShares: buyerShares,
            isDadae: document.getElementById('dadaeCheckbox') ? document.getElementById('dadaeCheckbox').checked : false
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

        // 보수료·부가가치세 editable input 에 계산값 설정
        document.getElementById('lawyerFeeInput').value = formatNumber(result.lawyerFee);
        document.getElementById('lawyerVatInput').value = formatNumber(result.lawyerVat);
        if (result.lawyerDiscountRate > 0) {
            document.getElementById('lawyerDiscountRow').style.display = 'flex';
            document.getElementById('lawyerDiscountLabel').textContent = '할인 -' + result.lawyerDiscountRate + '%';
            document.getElementById('lawyerDiscountAmount').textContent = '-' + formatNumber(result.lawyerDiscountAmount) + '원';
        } else {
            document.getElementById('lawyerDiscountRow').style.display = 'none';
        }
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

        // 항목 토글 체크박스 전체 초기화 (계산 시 모두 체크)
        ['includeTransport', 'includeBondService', 'includeTaxReport', 'includeSubmission', 'includeCert'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = true;
        });
        ['transportFeeRow', 'bondServiceFeeRow', 'taxReportFeeRow', 'submissionFeeRow', 'certFeeRow'].forEach(rowId => {
            const row = document.getElementById(rowId);
            if (row) row.classList.remove('row-disabled');
        });
    }

    // 비용 항목 토글 체크박스 이벤트
    ['includeTransport', 'includeBondService', 'includeTaxReport', 'includeSubmission', 'includeCert'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateFeeToggles);
    });

    // 토글 상태를 반영한 유효 결과 반환
    function getEffectiveResult() {
        if (!lastResult) return null;
        const r = lastResult;
        const chk = id => {
            const el = document.getElementById(id);
            return !el || el.checked;
        };
        const transportFee    = chk('includeTransport')   ? r.transportFee    : 0;
        const bondServiceFee  = chk('includeBondService') ? r.bondServiceFee  : 0;
        const taxReportFee    = chk('includeTaxReport')   ? r.taxReportFee    : 0;
        const submissionFee   = chk('includeSubmission')  ? r.submissionFee   : 0;
        const certFee         = chk('includeCert')        ? r.certFee         : 0;
        // 보수료·부가가치세는 사용자가 직접 수정한 값 우선 사용
        const lawyerFee       = parseInputNumber(document.getElementById('lawyerFeeInput')?.value || '0');
        const lawyerVat       = parseInputNumber(document.getElementById('lawyerVatInput')?.value || '0');
        const lawyerTotal     = lawyerFee + lawyerVat;
        const otherTotal = r.stampTax + r.registrationFee + lawyerTotal +
                           transportFee + bondServiceFee + taxReportFee + submissionFee + certFee;
        const grandTotal = r.acquisition.total + r.bond.discountAmount + otherTotal;
        return { ...r, lawyerFee, lawyerVat, lawyerTotal, transportFee, bondServiceFee, taxReportFee, submissionFee, certFee, otherTotal, grandTotal };
    }

    // 토글 변경 시 화면 합계 갱신
    function updateFeeToggles() {
        const r = getEffectiveResult();
        if (!r) return;

        // 행 비활성화 스타일 및 금액 표시
        const rowMap = {
            'transportFeeRow':  { id: 'includeTransport',   amtId: 'transportFeeResult', val: r.transportFee },
            'bondServiceFeeRow':{ id: 'includeBondService', amtId: 'bondServiceFee',      val: r.bondServiceFee },
            'taxReportFeeRow':  { id: 'includeTaxReport',   amtId: 'taxReportFee',        val: r.taxReportFee },
            'submissionFeeRow': { id: 'includeSubmission',  amtId: 'submissionFee',       val: r.submissionFee },
            'certFeeRow':       { id: 'includeCert',        amtId: 'certFee',             val: r.certFee },
        };
        Object.entries(rowMap).forEach(([rowId, cfg]) => {
            const row = document.getElementById(rowId);
            const chkEl = document.getElementById(cfg.id);
            if (!row || !chkEl) return;
            const checked = chkEl.checked;
            row.classList.toggle('row-disabled', !checked);
            const amtEl = document.getElementById(cfg.amtId);
            if (amtEl) amtEl.textContent = formatNumber(cfg.val) + '원';
        });

        // 합계 갱신
        document.getElementById('otherTotal').textContent  = formatNumber(r.otherTotal) + '원';
        document.getElementById('grandTotal').textContent  = formatNumber(r.grandTotal) + '원';
        document.getElementById('summaryOther').textContent = formatNumber(r.otherTotal) + '원';
    }

    // 보수료·부가가치세 직접 수정 시 합계 갱신
    ['lawyerFeeInput', 'lawyerVatInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateFeeToggles);
    });

    // 복사 버튼 이벤트
    const copyAllBtn = document.getElementById('copyAllBtn');
    const copyForMasterBtn = document.getElementById('copyForMasterBtn');
    const copyForBubtongBtn = document.getElementById('copyForBubtongBtn');

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
보수료: ${formatNumber(parseInputNumber(document.getElementById('lawyerFeeInput').value))}원
부가가치세: ${formatNumber(parseInputNumber(document.getElementById('lawyerVatInput').value))}원

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
                parseInputNumber(document.getElementById('lawyerFeeInput').value),
                parseInputNumber(document.getElementById('lawyerVatInput').value)
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

    if (copyForBubtongBtn) {
        copyForBubtongBtn.addEventListener('click', function() {
            if (!lastResult) return;

            // 법무통 견적서 제출폼 순서 (채권 항목은 제외): 취득세, 지방교육세, 농어촌특별세, 인지대, 증지대, 법무사비용, 부가세
            const values = [
                lastResult.acquisition.acquisitionTax,
                lastResult.acquisition.educationTax,
                lastResult.acquisition.ruralTax,
                lastResult.stampTax,
                lastResult.registrationFee,
                parseInputNumber(document.getElementById('lawyerFeeInput').value),
                parseInputNumber(document.getElementById('lawyerVatInput').value)
            ];

            const text = values.join('\t');

            navigator.clipboard.writeText(text).then(() => {
                copyForBubtongBtn.textContent = '복사 완료!';
                copyForBubtongBtn.classList.add('copied');
                setTimeout(() => {
                    copyForBubtongBtn.textContent = '법무통용 복사';
                    copyForBubtongBtn.classList.remove('copied');
                }, 2000);
            });
        });
    }

    // 영수증 출력 (새 창 인쇄)
    const printReceiptBtn = document.getElementById('printReceiptBtn');
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', function() {
            if (!lastResult) return;

            const r = getEffectiveResult();
            const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
            const address = document.getElementById('address').value || '-';
            const caseName = document.getElementById('caseName').value || '소유권이전';
            const clientName = document.getElementById('clientName').value || '-';
            const standardPriceVal = parseInputNumber(document.getElementById('standardPrice').value);
            const taxDiscountRadio = document.querySelector('input[name="taxDiscount"]:checked');
            const discountLimitNotice = (taxDiscountRadio && taxDiscountRadio.value !== 'none' && r.salePrice > 1200000000)
                ? `※ 매매대금 12억 초과로 ${taxDiscountRadio.value === 'firstTime' ? '생애최초감면' : '신생아감면'}이 적용되지 않았습니다.`
                : '';


            const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>등기비용 견적서</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Pretendard', -apple-system, sans-serif; color: #2c2416; background: #fff; margin: 0; padding: 15mm 0 8mm; font-size: 13px; line-height: 1.5; }
  .page { max-width: 130mm; margin: 0 auto; }
  h1 { text-align:center; font-size:23px; font-weight:900; letter-spacing:2px; color:#3d3229; padding-bottom:3mm; border-bottom:2px solid #3d3229; margin-bottom:3mm; }
  .date { text-align:center; font-size:12px; color:#8b7355; margin-bottom:3mm; }
  table { width:100%; border-collapse:collapse; margin-bottom:3mm; }
  .info-table { border:1px solid #d0c4b0; }
  .info-table td { padding:3px 6px; font-size:13px; border:1px solid #d0c4b0; }
  .info-table td.label { background:#f5f0e8; color:#6b5d4d; font-weight:600; width:18%; text-align:center; }
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
  .toolbar { position:fixed; top:0; left:0; right:0; background:#3d3229; padding:10px 20px; display:flex; gap:10px; justify-content:flex-end; z-index:999; }
  .toolbar button { padding:8px 18px; border:none; border-radius:6px; font-size:13px; cursor:pointer; font-family:inherit; font-weight:600; }
  .btn-image { background:#a08060; color:#fff; }
  .btn-pdf { background:#f5c842; color:#3d3229; }
  .btn-close { background:transparent; color:#f5f0e8; border:1px solid rgba(255,255,255,0.4) !important; }
  @media print { .toolbar { display:none; } @page { margin: 0; } body { padding: 15mm 0 8mm; } }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head>
<body>
<div class="toolbar">
  <button class="btn-image" onclick="saveImage()">이미지 저장</button>
  <button class="btn-pdf" onclick="window.print()">PDF 저장 / 인쇄</button>
  <button class="btn-close" onclick="window.close()">✕ 닫기</button>
</div>
<div style="height:50px;"></div>
<div class="page" id="receipt-page">
  <h1>부동산 등기비용 견적서</h1>
  <div class="date">${today}</div>

  <table class="info-table">
    <tr>
      <td class="label">고객명</td><td>${clientName}</td>
      <td class="label">사건명</td><td>${caseName}</td>
    </tr>
    <tr>
      <td class="label">매매대금</td><td><strong>${formatNumber(r.salePrice)}원</strong></td>
      <td class="label">과세표준액</td><td>${standardPriceVal > 0 ? formatNumber(standardPriceVal) + '원' : '-'}</td>
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
  ${discountLimitNotice ? `<div class="note" style="color:#c0392b;">${discountLimitNotice}</div>` : ''}

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

  <div class="disclaimer">※ 본 견적서는 예상 금액이며 국민주택채권은 등기 당일 시세로 변동 됩니다.</div>
</div>
<script>
function saveImage() {
  var btn = document.querySelector('.btn-image');
  btn.textContent = '저장 중...';
  btn.disabled = true;
  var margin = 20;
  html2canvas(document.getElementById('receipt-page'), { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(function(canvas) {
    var newCanvas = document.createElement('canvas');
    newCanvas.width = canvas.width + margin * 2 * 2;
    newCanvas.height = canvas.height + margin * 2 * 2;
    var ctx = newCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
    ctx.drawImage(canvas, margin * 2, margin * 2);
    var a = document.createElement('a');
    a.download = '등기비용견적서.png';
    a.href = newCanvas.toDataURL('image/png');
    a.click();
    btn.textContent = '이미지 저장';
    btn.disabled = false;
  });
}
<\/script>
</body>
</html>`;

            const win = window.open('', '_blank');
            win.document.write(html);
            win.document.close();
            win.focus();
        });
    }

    // 매수인 수 변경 시 지분 입력 UI 갱신
    const buyerCountInputEl = document.getElementById('buyerCount');
    const buyerSharesContainer = document.getElementById('buyerSharesContainer');
    const buyerSharesList = document.getElementById('buyerSharesList');

    function updateLastBuyerShare(count) {
        const inputs = [];
        for (let i = 0; i < count - 1; i++) {
            inputs.push(document.getElementById(`buyerShare_pct_${i}`));
        }
        const lastInput = document.getElementById(`buyerShare_pct_${count - 1}`);
        if (!lastInput) return;
        const used = inputs.reduce((sum, el) => sum + (parseFloat(el ? el.value : 0) || 0), 0);
        const remaining = Math.max(0, Math.round((100 - used) * 10) / 10);
        lastInput.value = remaining;
    }

    function renderBuyerShares(count) {
        if (!buyerSharesContainer || !buyerSharesList) return;
        if (count < 2) {
            buyerSharesContainer.style.display = 'none';
            buyerSharesList.innerHTML = '';
            return;
        }
        buyerSharesContainer.style.display = 'block';
        buyerSharesList.innerHTML = '';
        buyerSharesList.style.cssText = 'display:flex; align-items:center; gap:16px; flex-wrap:wrap;';
        const equalShare = Math.round((100 / count) * 10) / 10;
        for (let i = 0; i < count; i++) {
            const isLast = i === count - 1;
            const defaultVal = isLast ? Math.round((100 - equalShare * (count - 1)) * 10) / 10 : equalShare;
            const cell = document.createElement('div');
            cell.style.cssText = 'display:flex; align-items:center; gap:6px;';
            cell.innerHTML = `
                <span style="font-size:14px; color:var(--text-primary); white-space:nowrap;">매수인${i + 1}</span>
                <input type="number" id="buyerShare_pct_${i}" value="${defaultVal}" min="0" max="100" step="0.1"
                    ${isLast ? 'readonly' : ''}
                    style="width:70px; text-align:center; border:1px solid #c8b89a; border-radius:6px; padding:5px; font-size:14px;${isLast ? ' background:#f0ebe2; color:var(--text-secondary);' : ''}">
                <span style="font-size:14px; color:var(--text-secondary);">%</span>
            `;
            buyerSharesList.appendChild(cell);
        }
        // 앞 매수인 입력 시 마지막 자동 갱신
        for (let i = 0; i < count - 1; i++) {
            const el = document.getElementById(`buyerShare_pct_${i}`);
            if (el) el.addEventListener('input', () => updateLastBuyerShare(count));
        }
    }

    if (buyerCountInputEl) {
        buyerCountInputEl.addEventListener('change', function() {
            renderBuyerShares(parseInt(this.value) || 1);
        });
        // 초기 렌더
        renderBuyerShares(parseInt(buyerCountInputEl.value) || 1);
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

    // URL 쿼리파라미터 자동채움 (법무통 견적요청 카드 OCR 연동용, ocr_autofill.py가 생성한 링크로 진입 시 동작)
    function applyUrlParams() {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('salePrice')) return;

        const bubtongBtn = document.querySelector('.platform-btn[data-platform="bubtong"]');
        if (bubtongBtn) bubtongBtn.click();

        const type = params.get('type');
        if (type) {
            const typeBtn = document.querySelector(`.property-type-btn[data-type="${type}"]`);
            if (typeBtn) typeBtn.click();
        }

        const clientNameInput = document.getElementById('clientName');
        if (clientNameInput && params.get('clientName')) {
            clientNameInput.value = params.get('clientName');
        }

        if (addressInput && params.get('address')) {
            addressInput.value = params.get('address');
            addressInput.dispatchEvent(new Event('input'));
        }

        if (params.get('salePrice')) {
            salePriceInput.value = params.get('salePrice');
            salePriceInput.dispatchEvent(new Event('input'));
        }

        const taxDiscount = params.get('taxDiscount');
        if (taxDiscount) {
            const radio = document.querySelector(`input[name="taxDiscount"][value="${taxDiscount}"]`);
            if (radio) radio.checked = true;
        }

        if (params.has('under85')) {
            const under85Checkbox = document.getElementById('under85sqm');
            if (under85Checkbox) under85Checkbox.checked = params.get('under85') === '1';
        }

        calculateBtn.click();
    }

    applyUrlParams();

    // 오늘의 채권할인율 자동 채움 (GitHub Actions가 매일 갱신하는 bond_rate.json 사용)
    fetch('./bond_rate.json')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (data && data.rate) {
                bondRateInput.value = data.rate;
                bondRateInput.placeholder = `${data.date} 기준`;
            }
        })
        .catch(() => {});
});
