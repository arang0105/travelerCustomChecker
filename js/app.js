/* =====================================================
   여행자 관세 계산기 — 메인 로직
   ===================================================== */

/* ─── 세율 상수 (관세청 기준) ──────────────────────
   출처: 관세청 ItemTaxCalculation.do
   ※ 실제 세율은 HS Code·원산지·협정에 따라 다를 수 있음
   ===================================================== */
const CALCULATION_RULES = {

  // 주류 품목별 간이세율 (면세 한도 초과 시 전액 과세)
  liquor: {
    WINE:     { label: "🍷 포도주 (와인)",                    rate: 0.68  },
    WHISKEY:  { label: "🥃 위스키 / 브랜디 / 보드카 / 진 / 럼", rate: 1.55  },
    SAKE:     { label: "🍶 사케 (일본청주)",                  rate: 0.68  },
    BEER:     { label: "🍺 맥주",                             rate: 0.46  },
    // ※ 맥주는 실제로 리터당 세금(종량세) 방식이나 단순화를 위해 46% 적용 (추후 고도화 예정)
    GAOLIANG: { label: "🍾 고량주",                           rate: 1.55  },
    OTHER:    { label: "🍸 기타 주류",                        rate: 0.68  },
  },

  // 일반 품목 세율 카테고리
  general: {
    GENERAL:  { label: "일반 물품",           rate: 0.20, badge: "20%",  color: "bg-blue-100 text-blue-700"   },
    CLOTHING: { label: "의류 · 직물제품",     rate: 0.25, badge: "25%",  color: "bg-violet-100 text-violet-700" },
    LUXURY:   { label: "고가 물품 (가방·시계)", rate: 0.20, badge: "20%+", color: "bg-amber-100 text-amber-700"  },
    // ⚠️ 고가 물품(200만원 초과 가방·시계 등): 기본 간이세율 20% 적용 후
    //    과세가격이 200만원 초과 시 초과분에 개별소비세 로직 별도 적용 필요.
    //    개별소비세 = (과세가격 - 2,000,000) × 20%
    //    + 교육세 = 개별소비세 × 30%
    //    + 농어촌특별세 = 개별소비세 × 10%
    //    정확한 계산은 관세청 ItemTaxCalculation.do 참고
  },

  // 면세 한도 (USD 기준)
  exemption: {
    general: 800,
    liquor:  400,
  },

  // 자진신고 감면
  selfDeclare: {
    rate:   0.30,
    maxKRW: 150_000,
  },
};

/* ─── 국가/통화 데이터 ──────────────────────────── */
// displayUnit: 네이버 기준 표시 단위 (JPY·VND는 100단위, 나머지는 1단위)
const COUNTRIES = [
  { code:"USD", flag:"🇺🇸", name:"미국",     symbol:"$",   unit:"달러",         step:"0.01", displayUnit:1   },
  { code:"JPY", flag:"🇯🇵", name:"일본",     symbol:"¥",   unit:"엔",           step:"1",    displayUnit:100 },
  { code:"THB", flag:"🇹🇭", name:"태국",     symbol:"฿",   unit:"바트",         step:"0.01", displayUnit:1   },
  { code:"VND", flag:"🇻🇳", name:"베트남",   symbol:"₫",   unit:"동",           step:"1",    displayUnit:100 },
  { code:"PHP", flag:"🇵🇭", name:"필리핀",   symbol:"₱",   unit:"페소",         step:"0.01", displayUnit:1   },
  { code:"HKD", flag:"🇭🇰", name:"홍콩",     symbol:"HK$", unit:"홍콩달러",     step:"0.01", displayUnit:1   },
  { code:"TWD", flag:"🇹🇼", name:"대만",     symbol:"NT$", unit:"대만달러",     step:"0.01", displayUnit:1   },
  { code:"SGD", flag:"🇸🇬", name:"싱가포르", symbol:"S$",  unit:"싱가포르달러", step:"0.01", displayUnit:1   },
  { code:"CNY", flag:"🇨🇳", name:"중국",     symbol:"¥",   unit:"위안",         step:"0.01", displayUnit:1   },
  { code:"EUR", flag:"🇪🇺", name:"유럽",     symbol:"€",   unit:"유로",         step:"0.01", displayUnit:1   },
];

/* ─── 유틸 ─────────────────────────────────────── */
const $    = id => document.getElementById(id);
const fmt  = n  => Math.round(n).toLocaleString("ko-KR");
const fmtC = (n, step) =>
  step === "1"
    ? Math.round(n).toLocaleString("ko-KR")
    : n.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct  = r  => `${Math.round(r * 100)}%`;

/* ─── 상태 ──────────────────────────────────────── */
let allRates    = {};
let currentCode = "USD";
let items       = [];   // { id, name, price, category }
let nextId      = 1;

const country = () => COUNTRIES.find(c => c.code === currentCode);

const curRate = () => {
  const c = country();
  const displayed = parseFloat($("exchangeRate").value)
    || ((allRates[currentCode] || 1350) * c.displayUnit);
  return displayed / c.displayUnit;
};
const usdRate = () => allRates["USD"] || 1350;

/* ─── 토글 스위치 (자진신고) ────────────────────── */
function initToggle() {
  const toggle = $("selfDeclare");
  const track  = toggle.nextElementSibling;
  const thumb  = track.nextElementSibling;
  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      track.style.background = "linear-gradient(to right, #6366f1, #7c3aed)";
      thumb.style.transform  = "translateX(1.5rem)";
    } else {
      track.style.background = "";
      thumb.style.transform  = "";
    }
  });
}

/* ─── 국가 그리드 렌더링 ────────────────────────── */
function renderCountryGrid() {
  const grid = $("countryGrid");
  grid.innerHTML = "";
  COUNTRIES.forEach(c => {
    const btn = document.createElement("button");
    btn.className = `country-btn flex flex-col items-center gap-0.5 p-2 rounded-xl border-2
                     border-slate-200 bg-white text-slate-600
                     ${c.code === currentCode ? "active" : ""}`;
    btn.innerHTML = `
      <span class="text-2xl leading-none">${c.flag}</span>
      <span class="text-xs font-bold leading-tight mt-0.5">${c.name}</span>
      <span class="currency-code text-[10px] font-semibold text-slate-400 leading-none">${c.code}</span>`;
    btn.addEventListener("click", () => selectCountry(c.code));
    grid.appendChild(btn);
  });
}

function selectCountry(code) {
  currentCode = code;
  renderCountryGrid();
  updateRateDisplay();
  renderItems();
  updateSymbols();
}

/* ─── 환율 로드 ─────────────────────────────────── */
async function loadRate() {
  const btn  = $("refreshRateBtn");
  const icon = $("refreshIcon");
  btn.disabled = true;
  icon.classList.add("animate-spin");
  $("rateInfo").textContent = "실시간 환율 불러오는 중...";

  const CODES = ["USD","JPY","THB","VND","PHP","HKD","TWD","SGD","CNY","EUR"];

  try {
    // ① open.er-api.com 직접 호출 (CORS 허용 — Workers/Pages 모두 작동)
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error(`${res.status}`);
    const raw = await res.json();
    const krwPerUsd = raw.rates.KRW;
    if (!krwPerUsd) throw new Error("KRW 없음");

    allRates = {};
    for (const cur of CODES) {
      if (raw.rates[cur]) {
        allRates[cur] = Math.round((krwPerUsd / raw.rates[cur]) * 1000) / 1000;
      }
    }
    const date = raw.time_last_update_utc?.slice(0, 16) ?? "";
    $("rateInfo").textContent = `✅ 실시간 환율 · ${date} UTC`;

  } catch {
    try {
      // ② Cloudflare Pages Functions (Pages 배포 환경에서 활성화)
      const r2 = await fetch("/api/rate");
      if (!r2.ok) throw new Error("없음");
      const d2 = await r2.json();
      allRates = d2.rates;
      $("rateInfo").textContent = `✅ 실시간 · ${d2.date} · ${d2.source}`;
    } catch {
      // ③ 하드코딩 폴백
      allRates = {
        USD:1350, JPY:9.2, THB:38,  VND:0.053,
        PHP:24,   HKD:173, TWD:42,  SGD:1010,
        CNY:186,  EUR:1480,
      };
      $("rateInfo").textContent = "⚠️ 환율 로드 실패 — 임시 기본값 적용";
    }
  } finally {
    btn.disabled = false;
    icon.classList.remove("animate-spin");
    updateRateDisplay();
  }
}

/* ─── 환율 화면 갱신 ────────────────────────────── */
function updateRateDisplay() {
  const c       = country();
  const rawRate = allRates[currentCode] ?? 1350;
  const display = +(rawRate * c.displayUnit).toFixed(2);

  $("exchangeRate").value = display;
  $("badgeFlag").textContent = c.flag;
  $("badgeName").textContent = `${c.name} · ${c.code} ${c.unit}`;

  const unitLabel = c.displayUnit > 1 ? `${c.displayUnit}${c.symbol}` : `${c.symbol}1`;
  $("rateLabel").textContent = `${c.flag} ${c.code} / ${unitLabel}`;

  updateExemptDisplay(rawRate, usdRate());
}

function updateExemptDisplay(rawRate, usdR) {
  const c = country();
  if (currentCode === "USD") {
    $("generalExemptLocal").textContent = "";
    $("alcoholExemptLocal").textContent = "";
    $("exemptInfo").textContent         = "";
    return;
  }
  const g800 = Math.round(CALCULATION_RULES.exemption.general * usdR / rawRate);
  const a400 = Math.round(CALCULATION_RULES.exemption.liquor  * usdR / rawRate);
  $("generalExemptLocal").textContent = `≈ ${c.flag} ${c.symbol}${g800.toLocaleString("ko-KR")}`;
  $("alcoholExemptLocal").textContent = `≈ ${c.flag} ${c.symbol}${a400.toLocaleString("ko-KR")}`;
  $("exemptInfo").textContent         = `면세한도 ≈ ${c.symbol}${g800.toLocaleString("ko-KR")}`;
}

$("exchangeRate").addEventListener("input", () => {
  const displayed = parseFloat($("exchangeRate").value);
  const c = country();
  if (displayed > 0) {
    allRates[currentCode] = displayed / c.displayUnit;
    $("rateInfo").textContent = "✏️ 수동 입력 환율 적용 중";
    updateExemptDisplay(allRates[currentCode], usdRate());
  }
});
$("refreshRateBtn").addEventListener("click", loadRate);

/* ─── 통화 기호 동기화 ──────────────────────────── */
function updateSymbols() {
  const { symbol, step } = country();
  ["alcSymbol","perfSymbol","cigSymbol"].forEach(id => $(id).textContent = symbol);
  ["alcoholPrice","perfumePrice","cigarettePrice"].forEach(id => {
    $(id).step  = step;
    $(id).value = "";
  });
}

/* ─── 품목 관리 ─────────────────────────────────── */
function buildCategoryOptions(selected = "GENERAL") {
  return Object.entries(CALCULATION_RULES.general)
    .map(([key, r]) =>
      `<option value="${key}" ${key === selected ? "selected" : ""}>${r.label} (${pct(r.rate)})</option>`)
    .join("");
}

function renderItems() {
  const list = $("itemList");
  const hint = $("emptyHint");
  const sub  = $("generalSubtotal");
  const c    = country();

  list.innerHTML = "";
  if (items.length === 0) {
    hint.classList.remove("hidden");
    sub.classList.add("hidden");
    return;
  }
  hint.classList.add("hidden");
  sub.classList.remove("hidden");

  let total = 0;
  items.forEach(item => {
    total += item.price;
    const rule  = CALCULATION_RULES.general[item.category] || CALCULATION_RULES.general.GENERAL;
    const el    = document.createElement("div");
    el.className = "fade-in rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-colors overflow-hidden";
    el.innerHTML = `
      <!-- 품목명 행 -->
      <div class="flex items-center gap-2 p-3 pb-1.5">
        <input type="text" value="${item.name}"
          class="flex-1 min-w-0 bg-transparent text-sm text-slate-700 border-none
                 focus:outline-none placeholder-slate-300 font-medium"
          placeholder="품목명 (예: 코트, 운동화...)"
          onchange="updateItem(${item.id},'name',this.value)" />
        <button onclick="removeItem(${item.id})"
          class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg
                 text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
              d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <!-- 카테고리 + 가격 행 -->
      <div class="flex items-center gap-2 px-3 pb-3">
        <select onchange="updateItem(${item.id},'category',this.value)"
          class="field-focus flex-1 min-w-0 py-2 px-2.5 rounded-xl text-xs font-semibold
                 text-slate-600 cursor-pointer">
          ${buildCategoryOptions(item.category)}
        </select>
        <div class="relative shrink-0 w-28">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-black">${c.symbol}</span>
          <input type="number" min="0" step="${c.step}" value="${item.price || ""}"
            class="field-focus w-full pl-7 pr-2 py-2 rounded-xl text-sm text-right font-semibold"
            placeholder="0"
            onchange="updateItem(${item.id},'price',parseFloat(this.value)||0)" />
        </div>
        <span class="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${rule.color}">${rule.badge}</span>
      </div>`;
    list.appendChild(el);
  });
  $("generalTotal").textContent = `${c.flag} ${c.symbol}${fmtC(total, c.step)}`;
}

function addItem() {
  items.push({ id: nextId++, name: "", price: 0, category: "GENERAL" });
  renderItems();
  const inputs = $("itemList").querySelectorAll("input[type=text]");
  inputs[inputs.length - 1]?.focus();
}

window.updateItem = (id, field, value) => {
  const item = items.find(i => i.id === id);
  if (item) { item[field] = value; renderItems(); }
};
window.removeItem = id => {
  items = items.filter(i => i.id !== id);
  renderItems();
};
$("addItemBtn").addEventListener("click", addItem);

/* ─── 유효성 메시지 ─────────────────────────────── */
function setMsg(elId, text, ok) {
  const el = $(elId);
  el.textContent = text;
  el.className   = `text-xs mt-2 font-semibold px-2 py-1 rounded-lg inline-block
                    ${ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`;
  el.classList.remove("hidden");
}

/* ─── 관세 계산 핵심 로직 ───────────────────────── */
function calculate() {
  const c     = country();
  const cRate = curRate();
  const usdR  = usdRate();
  const toKRW  = usdAmt  => usdAmt * usdR;
  const locKRW = localAmt => localAmt * cRate;

  /* ── ① 일반 품목: 세율 높은 순으로 정렬 후 $800 면세 적용 ──
     세율이 높은 품목에 먼저 면세를 적용해야 전체 세액이 최소화됨
     (예: 의류 25%에 먼저 $800 공제 → 일반 20%에 나중 공제보다 절세) */
  const sortedItems = [...items]
    .map(i => ({
      ...i,
      priceKRW: locKRW(i.price || 0),
      rule: CALCULATION_RULES.general[i.category] || CALCULATION_RULES.general.GENERAL,
    }))
    .sort((a, b) => b.rule.rate - a.rule.rate);  // 세율 내림차순

  let remainExemptKRW = toKRW(CALCULATION_RULES.exemption.general);
  const itemDetails = [];

  for (const item of sortedItems) {
    const applied    = Math.min(remainExemptKRW, item.priceKRW);
    remainExemptKRW -= applied;
    const taxableKRW = item.priceKRW - applied;
    itemDetails.push({
      ...item,
      appliedExemptKRW: applied,
      taxableKRW,
      taxKRW: taxableKRW * item.rule.rate,
    });
  }

  const generalTaxKRW = itemDetails.reduce((s, d) => s + d.taxKRW, 0);

  /* ── ② 주류 ── */
  const alcLocal   = parseFloat($("alcoholPrice").value)   || 0;
  const alcBottles = parseFloat($("alcoholBottles").value)  || 0;
  const alcVolume  = parseFloat($("alcoholVolume").value)   || 0;
  const alcTypeKey = $("alcoholType").value;
  const alcRule    = CALCULATION_RULES.liquor[alcTypeKey] || CALCULATION_RULES.liquor.WINE;
  const alcKRW     = locKRW(alcLocal);
  const alcFree    = alcBottles <= 2 && alcVolume <= 2 && alcKRW <= toKRW(CALCULATION_RULES.exemption.liquor);
  const alcTaxKRW  = alcFree ? 0 : alcKRW * alcRule.rate;

  if (alcLocal > 0) {
    if (alcFree) {
      setMsg("alcoholMsg", "✅ 주류 면세 조건 충족", true);
    } else {
      const r = [];
      if (alcBottles > 2)                                   r.push(`병 수 초과(${alcBottles}병)`);
      if (alcVolume  > 2)                                   r.push(`용량 초과(${alcVolume}L)`);
      if (alcKRW > toKRW(CALCULATION_RULES.exemption.liquor)) r.push("가격 초과($400)");
      setMsg("alcoholMsg", `⚠️ ${r.join(" · ")} — ${alcRule.label} ${pct(alcRule.rate)} 세율 적용`, false);
    }
  } else {
    $("alcoholMsg").classList.add("hidden");
  }

  /* ── ③ 향수 ── */
  const perfLocal  = parseFloat($("perfumePrice").value)  || 0;
  const perfVolume = parseFloat($("perfumeVolume").value)  || 0;
  const perfKRW    = locKRW(perfLocal);
  const perfFree   = perfVolume <= 100;
  const perfTaxKRW = perfFree ? 0 : perfKRW * 0.20;  // 향수 간이세율 20%

  if (perfLocal > 0) {
    if (perfFree) setMsg("perfumeMsg", "✅ 향수 면세 조건 충족", true);
    else          setMsg("perfumeMsg", `⚠️ 용량 초과 (${perfVolume}ml > 100ml)`, false);
  } else {
    $("perfumeMsg").classList.add("hidden");
  }

  /* ── ④ 담배 ── */
  const cigLocal  = parseFloat($("cigarettePrice").value) || 0;
  const cigCount  = parseFloat($("cigaretteCount").value) || 0;
  const cigKRW    = locKRW(cigLocal);
  const cigFree   = cigCount <= 200;
  const cigTaxKRW = cigFree ? 0 : cigKRW * 0.20;

  if (cigLocal > 0) {
    if (cigFree) setMsg("cigaretteMsg", "✅ 담배 면세 조건 충족", true);
    else         setMsg("cigaretteMsg", `⚠️ 수량 초과 (${cigCount}개비 > 200개비)`, false);
  } else {
    $("cigaretteMsg").classList.add("hidden");
  }

  /* ── ⑤ 합산 세액 ── */
  const rawTaxKRW = generalTaxKRW + alcTaxKRW + perfTaxKRW + cigTaxKRW;

  /* ── ⑥ 자진신고 감면 (마지막에 합산 세액 전체에 적용) ── */
  const selfDeclare = $("selfDeclare").checked;
  const discount    = selfDeclare && rawTaxKRW > 0
    ? Math.min(rawTaxKRW * CALCULATION_RULES.selfDeclare.rate, CALCULATION_RULES.selfDeclare.maxKRW)
    : 0;
  const finalKRW = Math.max(0, rawTaxKRW - discount);

  /* ── ⑦ 결과 렌더링 ── */
  $("resultCard").classList.remove("hidden");

  renderBreakdown({
    c, itemDetails, generalTaxKRW,
    alcLocal, alcKRW, alcFree, alcTaxKRW, alcRule,
    perfLocal, perfKRW, perfFree, perfTaxKRW,
    cigLocal,  cigKRW, cigFree,  cigTaxKRW,
    rawTaxKRW, selfDeclare, discount,
  });

  const isFree = finalKRW === 0;
  $("resultLabel").textContent  = isFree ? "납부 관세 없음 🎊" : "예상 납부 관세";
  $("resultAmount").textContent = `₩${fmt(finalKRW)}`;
  $("resultUsd").textContent    = isFree ? "" : `≈ $${(finalKRW / usdR).toFixed(2)} USD`;
  $("selfDeclareNote").classList.toggle("hidden", !selfDeclare || rawTaxKRW === 0);
  $("dutyFreeNotice").classList.toggle("hidden", !isFree);

  $("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
  $("resultAmount").classList.remove("pulse-once");
  void $("resultAmount").offsetWidth;
  $("resultAmount").classList.add("pulse-once");
}

/* ─── 계산 내역 렌더링 ──────────────────────────── */
function renderBreakdown(d) {
  const bd  = $("breakdown");
  bd.innerHTML = "";
  const sym = d.c.symbol;
  const fC  = v => fmtC(v, d.c.step);

  function row(label, val, bold = false, colorCls = "") {
    const el = document.createElement("div");
    el.className = `breakdown-row text-sm ${bold ? "font-bold text-slate-800" : "text-slate-500"} ${colorCls}`;
    el.innerHTML = `<span>${label}</span><span class="${bold ? "text-indigo-700" : ""}">${val}</span>`;
    bd.appendChild(el);
  }
  function divider(label = "") {
    const el = document.createElement("div");
    el.className = "my-2 flex items-center gap-2";
    el.innerHTML = label
      ? `<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">${label}</span>
         <div class="flex-1 border-t-2 border-dashed border-indigo-100"></div>`
      : `<div class="flex-1 border-t-2 border-dashed border-indigo-100"></div>`;
    bd.appendChild(el);
  }

  /* 일반 품목 내역 (세율 높은 순으로 이미 정렬됨) */
  if (d.itemDetails.length > 0) {
    d.itemDetails.forEach(item => {
      const exemptLabel = item.appliedExemptKRW > 0
        ? ` <span class="text-green-600 text-xs">(면세 -₩${fmt(item.appliedExemptKRW)})</span>`
        : "";
      row(
        `${item.name || "품목"} <span class="text-xs text-slate-400">${item.rule.label} · ${pct(item.rule.rate)}</span>${exemptLabel}`,
        item.taxableKRW > 0 ? `세액 ₩${fmt(item.taxKRW)}` : "✅ 면세"
      );
    });
    row("일반 품목 소계", `₩${fmt(d.generalTaxKRW)}`, true);
  }

  /* 별도 면세 품목 */
  if (d.alcLocal > 0 || d.perfLocal > 0 || d.cigLocal > 0) {
    divider("별도 면세 품목");
    if (d.alcLocal > 0) {
      row(
        `🍷 주류 ${d.alcFree ? "" : `<span class="text-xs text-slate-400">${d.alcRule.label} · ${pct(d.alcRule.rate)}</span>`}`,
        d.alcFree ? "✅ 면세" : `세액 ₩${fmt(d.alcTaxKRW)}`
      );
    }
    if (d.perfLocal > 0) row(`🌸 향수`, d.perfFree ? "✅ 면세" : `세액 ₩${fmt(d.perfTaxKRW)}`);
    if (d.cigLocal  > 0) row(`🚬 담배`, d.cigFree  ? "✅ 면세" : `세액 ₩${fmt(d.cigTaxKRW)}`);
  }

  /* 합산 및 감면 */
  divider("합산");
  row("합산 세액", `₩${fmt(d.rawTaxKRW)}`, true);
  if (d.selfDeclare && d.discount > 0) {
    row("자진신고 감면 (30%, 최대 15만원)", `-₩${fmt(d.discount)}`, false, "text-green-600 font-semibold");
  }
}

$("calcBtn").addEventListener("click", calculate);

/* ─── 초기화 ────────────────────────────────────── */
initToggle();
renderCountryGrid();
loadRate();
