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
 * 현재 선택된 "행사 + 회차(복수) + 테이블/행거 개수"를 종합해서
 * 최종 참가비를 계산하고 화면(round-fee-line)과 전송용 hidden input에 반영한다.
 */
function recalcFee() {
  const feeLine = document.getElementById("round-fee-line");
  const feeHidden = document.getElementById("fee-hidden");
  const hidden = document.getElementById("round-hidden");
  const tablesSelect = document.getElementById("tables");
  const eventSelect = document.getElementById("event");
  if (!feeLine || !feeHidden) return;

  const title = eventSelect ? eventSelect.value : "";
  const ev = allEventsCache.find((e) => e.title === title);

  const roundCount = hidden && hidden.value ? hidden.value.split("|||").filter((s) => s.trim()).length : 0;
  const sel = tablesSelect ? parseTableSelection(tablesSelect.value) : null;
  const unitPrice = ev ? parseBaseUnitPrice(ev.deposit) : null;

  // 셋 중 하나라도 아직 안 정해졌으면 계산하지 않는다
  if (!ev || roundCount === 0 || !sel || unitPrice === null) {
    feeLine.textContent = "";
    feeHidden.value = "";
    return;
  }

  const hangerUnitPrice = unitPrice / 2;
  const perRound = sel.type === "table" ? sel.count * unitPrice : sel.count * hangerUnitPrice;
  const total = perRound * roundCount;
  const totalText = `${total.toLocaleString()}원 (VAT별도)`;

  feeLine.textContent = `참가비: ${totalText}`;
  feeHidden.value = totalText;
}

function updateRoundOptions(title) {
  const container = document.getElementById("round-options");
  const hidden = document.getElementById("round-hidden");
  if (!container) return;

  container.innerHTML = "";
  if (hidden) hidden.value = "";
  recalcFee();

  const ev = allEventsCache.find((e) => e.title === title);
  const rounds = (ev && ev.rounds) || [];

  if (!title) {
    container.innerHTML = `<span class="round-empty">먼저 위에서 행사를 선택해 주세요</span>`;
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
    const wrap = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = name;
    cb.className = "round-checkbox";
    cb.id = `round-cb-${i}`;
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(name));
    container.appendChild(wrap);
  });

  container.querySelectorAll(".round-checkbox").forEach((cb) => {
    cb.addEventListener("change", () => {
      const selected = Array.from(container.querySelectorAll(".round-checkbox:checked")).map((c) => c.value);
      if (hidden) hidden.value = selected.join("|||");
      recalcFee();
    });

    // Formspree로 넘어가기 직전, 사람이 읽기 좋은 형태(쉼표+줄바꿈)로 실제 전송값을 바꿔치기
    if (!container.dataset.submitHookAdded) {
      container.dataset.submitHookAdded = "1";
      const formEl = container.closest("form");
      if (formEl) {
        formEl.addEventListener("submit", () => {
          if (hidden && hidden.value) {
            hidden.value = hidden.value.split("|||").filter((s) => s.trim()).join(", ");
          }
        });
      }
    }
  });
}

async function renderEventList() {
  const el = document.getElementById("event-list");
  if (!el) return;

  // 최초 1회만 데이터를 불러오고, 이후 필터/페이지 전환 시엔 캐시를 재사용
  if (allEventsCache.length === 0) {
    allEventsCache = await loadJSON("data/events.json");
  }
  const events = allEventsCache;

  // 모집중/모집예정 먼저, 마감은 맨 아래로 정렬
  events.sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] ?? 99;
    const orderB = STATUS_ORDER[b.status] ?? 99;
    return orderA - orderB;
  });

  renderCategoryFilters(el, events);

  if (events.length === 0) {
    el.innerHTML = `<div class="events-empty">현재 등록된 행사가 없습니다. 다음 모집 소식을 기다려 주세요.</div>`;
    return;
  }

  // 세부카테고리 필터 적용
  const filtered = events.filter(
    (ev) => currentEventCategory === "전체" || (ev.category || "기타") === currentEventCategory
  );

  // 10개 단위 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / EVENTS_PER_PAGE));
  if (currentEventPage > totalPages) currentEventPage = totalPages;
  const startIdx = (currentEventPage - 1) * EVENTS_PER_PAGE;
  const pageItems = filtered.slice(startIdx, startIdx + EVENTS_PER_PAGE);

  const listHtml = pageItems
    .map((ev) => {
      const i = events.indexOf(ev);
      const statusClass = STATUS_CLASS[ev.status] || "upcoming";
      const closed = ev.status === "마감";
      return `
      <div class="event-card">
        <button type="button" class="event-header" data-idx="${i}" aria-expanded="false">
          <div class="event-main">
            <span class="event-status ${statusClass}">${ev.status}</span>
            <h3>${ev.title}</h3>
            <div class="event-meta-inline">${ev.place}</div>
          </div>
          <span class="event-chevron">＋</span>
        </button>
        <div class="event-detail" id="event-detail-${i}">
          <div class="event-meta">
            <div><span class="k">PLACE</span>${ev.place}</div>
            <div><span class="k">FEE</span>${ev.deposit || "추후 안내"}</div>
            <div><span class="k">CATEGORY</span>${RECRUIT_CATEGORIES}</div>
            ${ev.deadline ? `<div><span class="k">DEADLINE</span>${ev.deadline}까지</div>` : ""}
          </div>
          ${ev.note ? `<div class="event-note">${ev.note}</div>` : ""}
          ${STATIC_INFO}
          <button class="btn" type="button" data-event-title="${ev.title}" ${closed ? "disabled" : ""}>
            ${closed ? "모집 마감" : "신청하기"}
          </button>
        </div>
      </div>`;
    })
    .join("");

  // 기존 목록 영역과 별도로, 필터 아래쪽에 실제 카드 목록을 넣을 컨테이너 확보
  let listContainer = document.getElementById("event-list-cards");
  if (!listContainer) {
    listContainer = document.createElement("div");
    listContainer.id = "event-list-cards";
    el.appendChild(listContainer);
  }
  listContainer.innerHTML = listHtml || `<div class="events-empty">이 카테고리에는 등록된 행사가 없습니다.</div>`;

  renderPagination(el, totalPages);

  // 행사 선택 셀렉트박스 채우기 (전체 행사 기준, 필터와 무관하게 항상 전체 옵션 제공)
  const select = document.getElementById("event");
  if (select) {
    select.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());
    events.forEach((ev) => {
      const opt = document.createElement("option");
      opt.value = ev.title;
      opt.textContent = `${ev.title}${ev.status === "마감" ? " (마감)" : ""}`;
      if (ev.status === "마감") opt.disabled = true;
      select.appendChild(opt);
    });

    // 행사를 선택하면, 그 행사에 등록된 회차 목록으로 "참여 회차"를 자동 갱신
    select.addEventListener("change", () => {
      updateRoundOptions(select.value);
    });
  }

  // 카드 헤더 클릭 → 아코디언 토글
  listContainer.querySelectorAll(".event-header").forEach((header) => {
    header.addEventListener("click", () => {
      const idx = header.dataset.idx;
      const detail = document.getElementById(`event-detail-${idx}`);
      const isOpen = detail.classList.contains("open");
      listContainer.querySelectorAll(".event-detail.open").forEach((d) => d.classList.remove("open"));
      listContainer.querySelectorAll(".event-header").forEach((h) => h.setAttribute("aria-expanded", "false"));

      // 다른(또는 같은) 행사 카드를 열고닫을 때마다, 이전에 열려있던 신청서는 일단 닫아둔다
      // (신청서는 오직 "신청하기" 버튼을 눌러야만 다시 뜬다)
      const applySection = document.getElementById("apply-section");
      if (applySection) applySection.style.display = "none";

      if (!isOpen) {
        detail.classList.add("open");
        header.setAttribute("aria-expanded", "true");
      }
    });
  });

  // "신청하기" 버튼 → 신청서 섹션 노출 + 행사 자동 선택 + 스크롤
  listContainer.querySelectorAll("button[data-event-title]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const title = btn.dataset.eventTitle;
      if (select) select.value = title;
      updateRoundOptions(title);
      const label = document.getElementById("selected-event-label");
      if (label) label.textContent = `선택한 행사: ${title}`;
      const applySection = document.getElementById("apply-section");
      applySection.style.display = "block";
      applySection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/**
 * 세부카테고리 필터 버튼들을 자동 생성한다.
 * (행사 데이터에 있는 category 값들을 모아서 중복 없이 버튼으로 만듦)
 */
function renderCategoryFilters(el, events) {
  let filterBar = document.getElementById("event-category-filters");
  if (!filterBar) {
    filterBar = document.createElement("div");
    filterBar.id = "event-category-filters";
    filterBar.className = "event-category-filters";
    el.parentNode.insertBefore(filterBar, el);
  }

  const categories = Array.from(
    new Set(events.map((ev) => ev.category || "기타"))
  );
  const allCats = ["전체", ...categories];

  filterBar.innerHTML = allCats
    .map(
      (cat) =>
        `<button type="button" class="category-filter-btn${cat === currentEventCategory ? " active" : ""}" data-category="${cat}">${cat}</button>`
    )
    .join("");

  filterBar.querySelectorAll(".category-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentEventCategory = btn.dataset.category;
      currentEventPage = 1; // 카테고리 바꾸면 1페이지로 초기화
      renderEventList();
    });
  });
}

/**
 * 페이지 번호 버튼들을 렌더링한다. (10개 초과 시에만 자동으로 나타남)
 */
function renderPagination(el, totalPages) {
  let pager = document.getElementById("event-pagination");
  if (!pager) {
    pager = document.createElement("div");
    pager.id = "event-pagination";
    pager.className = "event-pagination";
    el.appendChild(pager);
  }

  if (totalPages <= 1) {
    pager.innerHTML = "";
    return;
  }

  let buttons = "";
  for (let p = 1; p <= totalPages; p++) {
    buttons += `<button type="button" class="page-btn${p === currentEventPage ? " active" : ""}" data-page="${p}">${p}</button>`;
  }
  pager.innerHTML = buttons;

  pager.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentEventPage = parseInt(btn.dataset.page, 10);
      renderEventList();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function setupApplyForm() {
  const form = document.getElementById("apply-form");
  const success = document.getElementById("form-success");
  const select = document.getElementById("event");
  const label = document.getElementById("selected-event-label");
  const tablesSelect = document.getElementById("tables");
  if (!form) return;

  if (tablesSelect) {
    tablesSelect.addEventListener("change", recalcFee);
  }

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
    if (roundHidden && !roundHidden.value) {
      alert("참여 회차를 1개 이상 선택해 주세요.");
      const roundBox = document.getElementById("round-options");
      if (roundBox) roundBox.scrollIntoView({ behavior: "smooth", block: "center" });
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
