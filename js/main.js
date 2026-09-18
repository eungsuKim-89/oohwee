// OOHWEE — common site behavior
// events.json / reference.json 을 fetch로 읽어와 렌더링합니다.
// (관리자 페이지 /admin 에서 로그인해 수정하면 이 파일들이 자동으로 바뀝니다)

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }
});

async function loadJSON(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.items || [];
  } catch (err) {
    console.error("failed to load", path, err);
    return [];
  }
}

/**
 * 갤러리 그리드를 렌더링한다.
 */
async function renderGallery(targetId, limit, activeCategory) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const all = await loadJSON("data/reference.json");
  const items = all.filter(
    (item) => !activeCategory || activeCategory === "전체" || item.category === activeCategory
  );
  const shown = limit ? items.slice(0, limit) : items;

  if (shown.length === 0) {
    el.innerHTML = `
      <div class="gallery-empty">
        아직 등록된 사진이 없습니다.<br />
        관리자 페이지(/admin)에서 로그인 후 사진을 등록해 주세요.
      </div>`;
    return;
  }

  el.innerHTML = shown
    .map(
      (item) => `
      <figure>
        <a href="${item.image}" target="_blank" rel="noopener">
          <img src="${item.image}" alt="${item.caption || ""}" loading="lazy" />
          ${item.caption ? `<figcaption>${item.caption}</figcaption>` : ""}
        </a>
      </figure>`
    )
    .join("");
}

function setupFilters(buttonSelector, targetId) {
  const buttons = document.querySelectorAll(buttonSelector);
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderGallery(targetId, null, btn.dataset.category);
    });
  });
}

/* ==========================================================
   셀러 모집 페이지: 행사 목록 + 신청서 연동
   ========================================================== */

const STATUS_CLASS = { "모집중": "open", "모집예정": "upcoming", "마감": "closed" };

// 모집중/모집예정을 위로, 마감을 아래로 정렬할 때 쓰는 우선순위
const STATUS_ORDER = { "모집중": 0, "모집예정": 1, "마감": 2 };

// 한 페이지에 보여줄 행사 개수
const EVENTS_PER_PAGE = 10;

// 현재 선택된 세부카테고리 / 페이지 번호 (전역 상태)
let currentEventCategory = "전체";
let currentEventPage = 1;

const RECRUIT_CATEGORIES =
  "핸드메이드 / 패션(잡화) / 의류(홈웨어, 남성복, 스포츠 기능성 의류 등도 가능) / 액세서리 / 팬시 / 리빙 / 친환경물품 / 반려동물 용품 / 먹거리(즉석 제조 제외) / 브랜드홍보 등 [※ 예외 품목도 협의 가능]";

const STATIC_INFO = `
  <ul class="info-list">
    <li><span class="k">기본제공</span><span>1500mm 테이블 1개, 파라솔, 스트링 조명, 전기 (행거 사용 시 파라솔·조명만 제공)</span></li>
    <li><span class="k">개별지참</span><span>의자, 멀티탭, 개인 조명, 테이블보, 마감용 방수포 등</span></li>
    <li><span class="k">문의</span><span>theysayoohwee@gmail.com (문의 시 업체명·판매 품목을 함께 적어주세요)</span></li>
  </ul>`;

let allEventsCache = [];

/**
 * 선택한 행사(title)에 등록된 "회차 목록"으로 #round 셀렉트박스를 다시 채운다.
 * 회차가 하나도 등록 안 된 행사면, 회차 선택 없이 바로 진행 가능하게 만든다.
 */
/**
 * "기본 1500mm 테이블 2개" / "행거 1000mm 3개" 같은 문자열에서
 * 종류(table/hanger)와 개수를 뽑아낸다.
 */
function parseTableSelection(value) {
  if (!value) return null;
  const hangerMatch = value.match(/행거.*?(\d+)\s*개/);
  if (hangerMatch) return { type: "hanger", count: parseInt(hangerMatch[1], 10) };
  const tableMatch = value.match(/테이블.*?(\d+)\s*개/);
  if (tableMatch) return { type: "table", count: parseInt(tableMatch[1], 10) };
  return null;
}

/**
 * 참가비 안내문(예: "150,000원 (2일)")에서 "테이블 1개 기준 1회차당 단가"만 뽑아낸다.
 * 행거는 테이블의 절반 단가로 자동 계산한다 (행거 2개 = 테이블 1개와 같은 자리를 차지하므로).
 */
function parseBaseUnitPrice(depositText) {
  if (!depositText) return null;
  const m = depositText.match(/([\d,]+)\s*원/);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ""), 10);
}

/**
 * 체크된 회차마다 각자 고른 테이블/행거 선택을 모아서,
 * 회차별로 각각 계산한 금액을 합산한다. (회차마다 다른 품목 신청 가능)
 */
function recalcFee() {
  const feeLine = document.getElementById("round-fee-line");
  const feeHidden = document.getElementById("fee-hidden");
  const detailHidden = document.getElementById("round-detail-hidden");
  const hidden = document.getElementById("round-hidden");
  const eventSelect = document.getElementById("event");
  const container = document.getElementById("round-options");
  if (!feeLine || !feeHidden || !container) return;

  const title = eventSelect ? eventSelect.value : "";
  const ev = allEventsCache.find((e) => e.title === title);
  const unitPrice = ev ? parseBaseUnitPrice(ev.deposit) : null;

  const checkedRows = Array.from(container.querySelectorAll(".round-row")).filter(
    (row) => row.querySelector(".round-checkbox").checked
  );

  if (!ev || unitPrice === null || checkedRows.length === 0) {
    feeLine.textContent = "";
    feeHidden.value = "";
    if (detailHidden) detailHidden.value = "";
    if (hidden) hidden.value = "";
    return;
  }

  const hangerUnitPrice = unitPrice / 2;
  let total = 0;
  let allChosen = true;
  const roundNames = [];
  const detailLines = [];

  checkedRows.forEach((row) => {
    const roundName = row.querySelector(".round-checkbox").value;
    roundNames.push(roundName);
    const tableSelect = row.querySelector(".round-table-select");
    const tableValue = tableSelect ? tableSelect.value : "";
    const sel = parseTableSelection(tableValue);
    if (!sel) {
      allChosen = false;
      detailLines.push(`${roundName}: (품목 미선택)`);
      return;
    }
    const perRound = sel.type === "table" ? sel.count * unitPrice : sel.count * hangerUnitPrice;
    total += perRound;
    detailLines.push(`${roundName}: ${tableValue}`);
  });

  if (hidden) hidden.value = roundNames.join("|||");
  if (detailHidden) detailHidden.value = detailLines.join(" / ");

  if (!allChosen) {
    feeLine.textContent = "체크한 회차마다 신청 품목을 모두 선택해 주세요";
    feeHidden.value = "";
    return;
  }

  const totalText = `${total.toLocaleString()}원 (VAT별도)`;
  feeLine.textContent = `참가비: ${totalText} — ${detailLines.join(" / ")}`;
  feeHidden.value = totalText;
}

function updateRoundOptions(title) {
  const container = document.getElementById("round-options");
  const hidden = document.getElementById("round-hidden");
  if (!container) return;

  container.innerHTML = "";
  if (hidden) hidden.value = "";

  const ev = allEventsCache.find((e) => e.title === title);
  const rounds = (ev && ev.rounds) || [];

  if (!title) {
    container.innerHTML = `<span class="round-empty">먼저 위에서 행사를 선택해 주세요</span>`;
    recalcFee();
    return;
  }

  if (rounds.length === 0) {
    container.innerHTML = `<span class="round-empty">이 행사는 회차 구분이 없습니다</span>`;
    if (hidden) hidden.value = "회차 구분 없음";
    recalcFee();
    return;
  }

  rounds.forEach((r, i) => {
    const name = r.round_name || r;

    const row = document.createElement("div");
    row.className = "round-row";

    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = name;
    cb.className = "round-checkbox";
    cb.id = `round-cb-${i}`;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(name));
    row.appendChild(label);

    const tableSelect = document.createElement("select");
    tableSelect.className = "round-table-select";
    tableSelect.style.display = "none";
    tableSelect.innerHTML = `<option value="">품목 선택</option>
        <option value="기본 1500mm 테이블 1개">기본 1500mm 테이블 1개</option>
        <option value="기본 1500mm 테이블 2개">기본 1500mm 테이블 2개</option>
        <option value="행거 1000mm 2개">행거 1000mm 2개</option>
        <option value="행거 1000mm 3개">행거 1000mm 3개</option>
        <option value="행거 1000mm 4개">행거 1000mm 4개</option>`;
    row.appendChild(tableSelect);

    container.appendChild(row);

    cb.addEventListener("change", () => {
      tableSelect.style.display = cb.checked ? "block" : "none";
      if (!cb.checked) tableSelect.value = "";
      recalcFee();
    });
    tableSelect.addEventListener("change", recalcFee);
  });

  recalcFee();
}

function setupApplyForm() {
  const form = document.getElementById("apply-form");
  const success = document.getElementById("form-success");
  const select = document.getElementById("event");
  const label = document.getElementById("selected-event-label");
  if (!form) return;

  if (select && label) {
    select.addEventListener("change", () => {
      label.textContent = select.value ? `선택한 행사: ${select.value}` : "";
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 필수 입력칸 검증 — 빠진 곳이 있으면 그 칸으로 바로 스크롤 + 포커스 이동
    if (!form.checkValidity()) {
      const invalid = form.querySelector(":invalid");
      if (invalid) {
        invalid.scrollIntoView({ behavior: "smooth", block: "center" });
        invalid.focus({ preventScroll: true });
      }
      form.reportValidity();
      return;
    }

    const roundHidden = document.getElementById("round-hidden");
    const roundBox = document.getElementById("round-options");
    if (roundHidden && !roundHidden.value) {
      alert("참여 회차를 1개 이상 선택해 주세요.");
      if (roundBox) roundBox.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const uncheckedTable = roundBox
      ? Array.from(roundBox.querySelectorAll(".round-row")).find(
          (row) => row.querySelector(".round-checkbox").checked && !row.querySelector(".round-table-select").value
        )
      : null;
    if (uncheckedTable) {
      alert("체크한 회차마다 신청 품목(테이블/행거)을 선택해 주세요.");
      uncheckedTable.querySelector(".round-table-select").focus();
      uncheckedTable.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (form.action.includes("YOUR_FORM_ID")) {
      alert("아직 신청서 수신 이메일이 연결되지 않았어요. README의 Formspree 연결 안내를 먼저 진행해 주세요.");
      return;
    }
    const data = new FormData(form);
    try {
      const res = await fetch(form.action, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        form.style.display = "none";
        success.style.display = "block";
      } else {
        alert("전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch (err) {
      alert("전송에 실패했습니다. 네트워크를 확인해 주세요.");
    }
  });
}
