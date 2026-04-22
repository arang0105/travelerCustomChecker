/**
 * Cloudflare Pages Function: /api/rate
 * frankfurter.app API를 통해 USD → KRW 실시간 환율을 반환합니다.
 */
export async function onRequestGet(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=KRW",
      { cf: { cacheTtl: 3600, cacheEverything: true } }
    );

    if (!response.ok) {
      throw new Error(`Frankfurter API 오류: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.rates?.KRW;

    if (!rate) {
      throw new Error("KRW 환율 데이터를 찾을 수 없습니다.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        rate: Math.round(rate),
        date: data.date,
        source: "frankfurter.app",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    // 폴백: 고정 환율 반환 (API 장애 시)
    return new Response(
      JSON.stringify({
        success: false,
        rate: 1350,
        date: new Date().toISOString().split("T")[0],
        source: "fallback",
        error: err.message,
      }),
      { status: 200, headers: corsHeaders }
    );
  }
}
