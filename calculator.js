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
        transportFee: 30000,
        bondServiceFee: 0,
        taxReportFee: 0,
        submissionFee: 0,
        certFee: 0
    }
};

// 등기마스터 지역별 법무사 수수료
const MASTER_REGION_FEE = {
    'seoul_south': 250000,       // 서울남부 (강서,구로,금천,양천,영등포)
    'seoul_west': 250000,        // 서울서부 (마포,서대문,용산,은평)
    'seoul_central': 280000,     // 서울중앙 (강남,관악,동작,서초)
    'seoul_central_mid': 280000, // 서울중앙중부 (종로,중)
    'seoul_east': 280000,        // 서울동부 (강동,광진,성동,송파)
    'seoul_north': 280000,       // 서울북부 (강북,노원,도봉,동대문,성북,중랑)
    'gyeonggi_near': 250000,     // 경기 근거리 (광명,안양,시흥,부천)
    'gyeonggi_mid': 300000,      // 경기 중거리 (용인,수원,분당,하남,고양,김포,성남,안산,인천)
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

            // 감면 적용 표시
            if (taxDiscountType === 'firstTime') {
                note += ' (생애최초 감면 적용)';
            } else if (taxDiscountType === 'newborn') {
                note += ' (신생아 감면 적용)';
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

    // 감면 적용 (주택 1주택자만)
    if (propertyType === 'apartment' && houseCount === 1) {
        if (taxDiscountType === 'firstTime') {
            // 생애최초 감면: 취득세 200만원, 교육세 20만원
            acquisitionTax = Math.max(0, acquisitionTax - 2000000);
            educationTax = Math.max(0, educationTax - 200000);
        } else if (taxDiscountType === 'newborn') {
            // 신생아 감면: 취득세 500만원, 교육세 50만원
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
        note
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
 * 법무사 수수료 계산 (법무통용 - 매매대금 기준 구간별 고정)
 */
function calculateLawyerFeeBubtong(salePrice) {
    let fee = 0;

    if (salePrice <= 600000000) {
        fee = 250000;
    } else if (salePrice <= 1000000000) {
        fee = 300000;
    } else if (salePrice <= 2000000000) {
        fee = 350000;
    } else {
        fee = 400000;
    }

    const baseFee = fee;
    const vat = Math.round(fee * 0.1);

    return {
        baseFee,      // 보수료 (부가세 제외)
        vat,          // 부가가치세
        total: baseFee + vat  // 합계
    };
}

/**
 * 법무사 수수료 계산 (등기마스터용 - 지역별 고정)
 */
function calculateLawyerFeeMaster(masterRegion) {
    const fee = MASTER_REGION_FEE[masterRegion] || 250000;
    const baseFee = fee;
    const vat = Math.round(fee * 0.1);

    return {
        baseFee,      // 보수료 (부가세 제외)
        vat,          // 부가가치세
        total: baseFee + vat  // 합계
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
        lawyerFeeResult = calculateLawyerFeeMaster(params.masterRegion);
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
        masterRegion: params.masterRegion || '',
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
                    transportFeeInput.disabled = true;
                } else {
                    transportFeeInput.value = formatNumber(config.transportFee);
                    transportFeeInput.disabled = false;
                }
            }

            // 일반 플랫폼일 때만 할인율 옵션 표시
            if (lawyerDiscountGroup) {
                lawyerDiscountGroup.style.display = currentPlatform === 'general' ? 'block' : 'none';
            }

            // 등기마스터일 때만 지역 구분 표시
            const masterRegionGroup = document.getElementById('masterRegionGroup');
            if (masterRegionGroup) {
                masterRegionGroup.style.display = currentPlatform === 'master' ? 'block' : 'none';
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

                    // 등기마스터 지역 자동 감지
                    if (currentPlatform === 'master') {
                        const masterRegionSelect = document.getElementById('masterRegion');
                        if (masterRegionSelect) {
                            let detectedRegion = null;
                            if (data.sido === '서울특별시') {
                                detectedRegion = SEOUL_DISTRICT_TO_REGION[data.sigungu] || null;
                            } else if (data.sido === '경기도') {
                                const cityName = data.sigungu.split(' ')[0];
                                detectedRegion = GYEONGGI_CITY_TO_REGION[cityName] || null;
                            } else if (data.sido === '인천광역시') {
                                detectedRegion = 'gyeonggi_mid';
                            }
                            if (detectedRegion) {
                                masterRegionSelect.value = detectedRegion;
                            }
                        }
                    }
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

            // 등기마스터 지역 자동 감지 (마스터 플랫폼일 때만)
            if (currentPlatform !== 'master') return;
            const masterRegionSelect = document.getElementById('masterRegion');
            if (!masterRegionSelect) return;

            let detectedRegion = null;

            // 서울 구 감지 (구 이름만 있어도 매칭)
            for (const [district, region] of Object.entries(SEOUL_DISTRICT_TO_REGION)) {
                if (addr.includes(district)) {
                    detectedRegion = region;
                    break;
                }
            }

            // 경기도 시 감지
            if (!detectedRegion) {
                for (const [city, region] of Object.entries(GYEONGGI_CITY_TO_REGION)) {
                    if (addr.includes(city)) {
                        detectedRegion = region;
                        break;
                    }
                }
            }

            // 인천 감지
            if (!detectedRegion && addr.includes('인천')) {
                detectedRegion = 'gyeonggi_mid';
            }

            if (detectedRegion) {
                masterRegionSelect.value = detectedRegion;
            }
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
        const transportFee = currentPlatform === 'master' ? 0 : (parseInputNumber(transportFeeInput.value) || defaultTransportFee);

        const buyerCountInput = document.getElementById('buyerCount');
        const buyerCount = parseInt(buyerCountInput.value) || 1;

        const lawyerDiscountRadio = document.querySelector('input[name="lawyerDiscount"]:checked');
        const lawyerDiscount = lawyerDiscountRadio ? parseInt(lawyerDiscountRadio.value) : 0;

        const masterRegionSelect = document.getElementById('masterRegion');
        const masterRegion = masterRegionSelect ? masterRegionSelect.value : '';

        // 등기마스터 지역 미선택 시 경고
        if (currentPlatform === 'master' && !masterRegion) {
            alert('등기마스터 지역을 선택해주세요.');
            if (masterRegionSelect) masterRegionSelect.focus();
            return;
        }

        const params = {
            platform: currentPlatform,
            lawyerDiscount: lawyerDiscount,
            masterRegion: masterRegion,
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
        document.getElementById('taxNote').textContent = result.acquisition.note;

        // 국민주택채권
        document.getElementById('bondAmount').textContent = formatNumber(result.bond.bondAmount) + '원';
        document.getElementById('bondRate2').textContent = result.bond.bondRatePercent + '%';
        document.getElementById('bondDiscount').textContent = formatNumber(result.bond.discountAmount) + '원';
        document.getElementById('bondTotal').textContent = formatNumber(result.bond.discountAmount) + '원';

        // 기타 비용
        document.getElementById('stampTax').textContent = formatNumber(result.stampTax) + '원';
        document.getElementById('registrationFee').textContent = formatNumber(result.registrationFee) + '원';
        document.getElementById('transportFeeResult').textContent = formatNumber(result.transportFee) + '원';
        // 등기마스터는 교통비 행 숨김
        const transportFeeRow = document.getElementById('transportFeeRow');
        if (transportFeeRow) {
            transportFeeRow.style.display = (result.platform === 'master') ? 'none' : 'flex';
        }
        // 보수료 라벨 (등기마스터는 지역명 표시)
        const lawyerFeeLabel = document.getElementById('lawyerFeeLabel');
        if (lawyerFeeLabel) {
            if (result.platform === 'master' && result.masterRegion) {
                const regionLabel = MASTER_REGION_LABEL[result.masterRegion] || '';
                lawyerFeeLabel.textContent = regionLabel ? `보수료 (${regionLabel})` : '보수료';
            } else {
                lawyerFeeLabel.textContent = '보수료';
            }
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
