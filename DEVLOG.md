# ✈️ 여행자 관세 계산기 — 개발 대화 로그

> 작성일: 2026-04-22  
> 프로젝트: TravelerCustomChecker  
> 저장소: https://github.com/arang0105/travelerCustomChecker  
> 배포 URL: https://tcc.sangdori-mm.workers.dev/

---

## 📋 목차

1. [프로젝트 목적](#1-프로젝트-목적)
2. [기술 스택](#2-기술-스택)
3. [1단계 — 초기 파일 생성](#3-1단계--초기-파일-생성)
4. [2단계 — GitHub 푸시](#4-2단계--github-푸시)
5. [3단계 — 다국 통화 지원](#5-3단계--다국-통화-지원)
6. [4단계 — 환율 로드 실패 수정 & 네이버 단위 적용](#6-4단계--환율-로드-실패-수정--네이버-단위-적용)
7. [5단계 — UI 고급화 & 국기 표시](#7-5단계--ui-고급화--국기-표시)
8. [6단계 — 파일 구조 분리](#8-6단계--파일-구조-분리)
9. [최종 파일 구조](#9-최종-파일-구조)
10. [관세 계산 로직 정리](#10-관세-계산-로직-정리)
11. [트러블슈팅 기록](#11-트러블슈팅-기록)

---

## 1. 프로젝트 목적

해외여행 후 입국 시 납부해야 할 **여행자 휴대품 관세**를 실시간 환율을 반영하여 계산해주는 웹 애플리케이션.

- Cloudflare Pages/Workers에 배포
- Git으로 형상관리

---

## 2. 기술 스택

| 항목 | 내용 |
|---|---|
| Frontend | Single HTML + Vanilla JS + Tailwind CSS (CDN) |
| 폰트 | Pretendard (Google Fonts) |
| Backend | Cloudflare Pages Functions (Serverless) |
| 환율 API | open.er-api.com (무료, CORS 허용, 160+ 통화) |
| 배포 | Cloudflare Workers (workers.dev) |
| 형상관리 | Git + GitHub |

---

## 3. 1단계 — 초기 파일 생성

### 생성 파일

**`functions/api/rate.js`** — Cloudflare Pages Functions 환율 API
- `frankfurter.app` 호출 → USD/KRW 환율 반환
- API 실패 시 폴백 환율(₩1,350) 반환

**`index.html`** — 전체 프론트엔드 (HTML + CSS + JS 통합)
- Tailwind CSS 모바일 퍼스트 반응형
- 품목 추가 리스트 UI
- 관세 계산 결과 강조 표시

### 관세 계산 로직 (초기)

```
기본 면세: $800 공제
별도 면세: 주류(2병·2L·$400), 향수(100ml), 담배(200개비)
세율: 간이세율 20%
자진신고 감면: 세액의 30%, 최대 15만원
```

### Git 초기 설정

```bash
git config --global user.email "sangdori.mm@gmail.com"
git config --global user.name "arang0105"
git init
git add index.html functions/api/rate.js
git commit -m "feat: 여행자 관세 계산기 초기 버전"
git remote add origin https://github.com/arang0105/travelerCustomChecker.git
git push -u origin main
```

> ⚠️ 브랜치명 오류(`master` → `main`) 발생 → `git branch -M main` 으로 해결

---

## 4. 2단계 — GitHub 푸시

- 이메일 오타 수정 (`glc0420@gmail.com` → `sangdori.mm@gmail.com`)
- remote 재등록 후 정상 푸시 완료
- Cloudflare 연결 후 배포 URL 확인: `https://tcc.sangdori-mm.workers.dev/`

---

## 5. 3단계 — 다국 통화 지원

### 요청
> "우리나라 여행 많이 가는 국가 10군데 확인해서 통화별로 적용"

### 추가된 통화 (open.er-api.com으로 API 교체)

| 국가 | 통화 | 기호 |
|---|---|---|
| 🇺🇸 미국 | USD | $ |
| 🇯🇵 일본 | JPY | ¥ |
| 🇹🇭 태국 | THB | ฿ |
| 🇻🇳 베트남 | VND | ₫ |
| 🇵🇭 필리핀 | PHP | ₱ |
| 🇭🇰 홍콩 | HKD | HK$ |
| 🇹🇼 대만 | TWD | NT$ |
| 🇸🇬 싱가포르 | SGD | S$ |
| 🇨🇳 중국 | CNY | ¥ |
| 🇪🇺 유럽 | EUR | € |

### 주요 변경

- 국가 선택 버튼 그리드 추가
- 환율 표시 라벨에 통화 기호 반영
- 계산 로직: 현지통화 → KRW 환산 후 $800 면세 적용
- 면세 한도를 현지통화로 환산해서 안내

---

## 6. 4단계 — 환율 로드 실패 수정 & 네이버 단위 적용

### 문제 1: 환율 로드 실패

**원인:** 사이트가 Cloudflare Workers로 배포되어 `/api/rate` (Pages Functions) 가 404 반환

**해결:** HTML의 JS에서 `open.er-api.com`을 직접 호출 (CORS 허용)

```js
// 우선순위
// ① open.er-api.com 직접 호출 (항상 작동)
// ② /api/rate (Pages Functions — Pages 배포 시 활성화)
// ③ 하드코딩 폴백
```

### 문제 2: 네이버와 다른 환율 단위

**네이버 기준 단위:**

| 통화 | 단위 | 이유 |
|---|---|---|
| JPY (엔) | **100엔** 기준 | 1엔이 너무 작음 |
| VND (동) | **100동** 기준 | 1동이 너무 작음 |
| 나머지 8개 | 1단위 | 일반적 |

**적용 방법:**

```js
// COUNTRIES 데이터에 displayUnit 추가
{ code:"JPY", displayUnit:100 }  // 화면: ₩920 / ¥100 (엔)
{ code:"VND", displayUnit:100 }  // 화면: ₩5.3 / ₫100 (동)

// 내부 계산은 항상 1단위 KRW 기준 유지
const curRate = () => {
  const displayed = parseFloat(exchangeRateInput.value);
  return displayed / c.displayUnit;  // → KRW per 1 unit
};
```

---

## 7. 5단계 — UI 고급화 & 국기 표시

### 요청
> "나라 약자 앞에 국기도 붙여서 가시성 올려줘, 화면을 더 fancy하게"

### 국기 표시 위치

- 국가 버튼: `🇯🇵 일본 JPY` (3단 구성)
- 환율 레이블: `🇯🇵 JPY / 100¥`
- 선택 국가 배지: `🇺🇸 미국 · USD 달러`
- 품목 합계: `🇯🇵 ¥12,000`
- 면세 한도 환산: `≈ 🇯🇵 ¥116,000`

### 디자인 변경 내용

| 항목 | 변경 내용 |
|---|---|
| 배경 | 방사형 메시 그라데이션 |
| 헤더 | 인디고→퍼플 그라데이션 + 패턴 오버레이 |
| 카드 | 글래스모피즘 (blur + 반투명 + 흰 테두리) |
| 국가 버튼 | 활성화 시 인디고→퍼플 그라데이션 + 그림자 |
| 계산 버튼 | 그라데이션 + hover 시 위로 뜨는 효과 |
| 자진신고 | 체크박스 → 커스텀 토글 스위치 |
| 별도 면세 | 색상별 구분 카드 (로즈/퍼플/슬레이트) |
| 결과 카드 | 딥 퍼플 글로우 그라데이션 |
| 폰트 | Pretendard 적용 |
| 애니메이션 | fadeSlideIn, pulse-once 등 |

---

## 8. 6단계 — 파일 구조 분리

### 요청
> "파일 디렉토리를 디자인과 개발 부분 나눠서 해줘"

### 분리 전 (단일 파일)
```
index.html   ← HTML + CSS + JS 전부 (650줄)
```

### 분리 후 (관심사 분리)
```
index.html         ← HTML 뼈대만 (250줄)
css/style.css      ← 디자인 전담 (190줄)
js/app.js          ← 로직 전담  (270줄)
functions/api/rate.js  ← 서버사이드 환율 API
```

### 파일별 역할

| 파일 | 수정 상황 |
|---|---|
| `index.html` | UI 구조·레이아웃 변경 시 |
| `css/style.css` | 색상·폰트·애니메이션·카드 스타일 변경 시 |
| `js/app.js` | 환율 로직·계산식·국가 데이터 변경 시 |
| `functions/api/rate.js` | 서버 API 수정 시 |

---

## 9. 최종 파일 구조

```
TravelerCustomChecker/
├── index.html                 ← HTML 뼈대
├── css/
│   └── style.css              ← 디자인 (글래스모피즘, 그라데이션, 애니메이션)
├── js/
│   └── app.js                 ← 전체 로직 (환율, 계산, 국가, 품목 관리)
├── functions/
│   └── api/
│       └── rate.js            ← Cloudflare Pages Functions (환율 API)
└── DEVLOG.md                  ← 이 파일
```

---

## 10. 관세 계산 로직 정리

```
[입력]
- 여행 국가 선택 → 해당 통화 실시간 환율 적용
- 일반 품목 가격 (현지 통화)
- 별도 면세 품목 (주류/향수/담배)
- 자진신고 여부

[계산 순서]
1. 현지통화 → KRW 환산
   price_KRW = price_local × (KRW per 1 local unit)

2. 일반 품목 면세 공제
   기본 면세: $800 → KRW (= 800 × USD 환율)
   일반 과세 = max(0, 일반합계_KRW - 면세_KRW)

3. 별도 면세 판정
   주류: 2병 이하 AND 2L 이하 AND $400 이하 → 면세
   향수: 100ml 이하 → 면세
   담배: 200개비 이하 → 면세
   (조건 초과 시 전액 과세)

4. 총 과세 = 일반과세 + 주류과세 + 향수과세 + 담배과세

5. 세액 = 총과세 × 20% (간이세율)
   ※ 고가품은 실제 세율 다를 수 있음 (단순화 생략)

6. 자진신고 감면
   감면액 = min(세액 × 30%, 150,000원)
   최종 납부세액 = 세액 - 감면액
```

---

## 11. 트러블슈팅 기록

| 문제 | 원인 | 해결 |
|---|---|---|
| git push 실패 | `master` 브랜치 → `main` 불일치 | `git branch -M main` |
| git commit 실패 | 사용자 이메일 미설정 | `git config --global user.email` |
| remote 없음 오류 | 초기화 과정에서 remote 누락 | `git remote add origin ...` |
| 환율 로드 실패 (404) | Workers 배포라 Pages Functions 미작동 | HTML에서 `open.er-api.com` 직접 호출 |
| 환율 단위 불일치 | JPY·VND가 1단위로 표시됨 | `displayUnit:100` 추가, 네이버 기준 적용 |

---

## 커밋 히스토리

| 커밋 메시지 | 내용 |
|---|---|
| `feat: 여행자 관세 계산기 초기 버전` | index.html + functions/api/rate.js 최초 생성 |
| `feat: 한국인 여행 TOP 10 국가 다국 통화 지원 추가` | 10개국 통화 선택 기능 |
| `fix: 환율 직접 호출로 로드 실패 수정, 네이버 기준 단위 적용` | 환율 로드 버그 수정 + JPY·VND 100단위 |
| `design: 국기+약자 표시, 전체 UI 고급화` | 글래스모피즘·그라데이션·토글 스위치 |
| `refactor: HTML·CSS·JS 파일 분리` | 관심사 분리 (index / style.css / app.js) |
