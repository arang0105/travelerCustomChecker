/**
 * Cloudflare Pages Function: /api/rate
 * open.er-api.com 기반으로 한국인 여행 TOP 10 국가 통화의 KRW 환율을 반환합니다.
 * 반환값: { rates: { USD: 1350, JPY: 9.2, ... } }  → 각 통화 1단위당 KRW
 */

const CURRENCIES = ["USD", "JPY", "THB", "VND", "PHP", "HKD", "TWD", "SGD", "CNY", "EUR"];

// API 장애 시 사용할 폴백 환율 (수동 갱신 필요)
const FALLBACK_RATES = {
  USD: 1350, JPY: 9.2,  THB: 38,   VND: 0.053,
  PHP: 24,   HKD: 173,  TWD: 42,   SGD: 1010,
  CNY: 186,  EUR: 1480,
};

export async function onRequestGet(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    // open.er-api.com — 무료, API Key 불필요, 160+ 통화 지원
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cf: { cacheTtl: 3600, cacheEverything: true },
    });

    if (!res.ok) throw new Error(`API 오류: ${res.status}`);

    const data = await res.json();
    const raw  = data.rates;

    if (!raw?.KRW) throw new Error("KRW 환율 데이터 없음");

    const krwPerUsd = raw.KRW;

    // 각 통화 1단위 = ? KRW  (cross rate)
    const rates = {};
    for (const cur of CURRENCIES) {
      if (raw[cur]) {
        rates[cur] = Math.round((krwPerUsd / raw[cur]) * 100) / 100;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rates,
        date: data.time_last_update_utc?.slice(0, 16) ?? new Date().toISOString().slice(0, 10),
        source: "open.er-api.com",
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        rates: FALLBACK_RATES,
        date: new Date().toISOString().slice(0, 10),
        source: "fallback",
        error: err.message,
      }),
      { status: 200, headers: corsHeaders }
    );
  }
}
