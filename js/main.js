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

const STATIC_INFO = `
  <ul class="info-list">
    <li><span class="k">기본제공</span><span>1500mm 테이블 1개, 파라솔, 스트링 조명, 전기 (행거 사용 시 파라솔·조명만 제공)</span></li>
    <li><span class="k">개별지참</span><span>의자, 멀티탭, 개인 조명, 테이블보, 마감용 방수포 등</span></li>
    <li><span class="k">문의</span><span>theysayoohwee@gmail.com (문의 시 업체명·판매 품목을 함께 적어주세요)</span></li>
  </ul>`;

let allEventsCache = [];

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
            <div class="event-meta-inline">${ev.date} · ${ev.place}</div>
          </div>
          <span class="event-chevron">＋</span>
        </button>
        <div class="event-detail" id="event-detail-${i}">
          <div class="event-meta">
            <div><span class="k">DATE</span>${ev.date}</div>
            <div><span class="k">PLACE</span>${ev.place}</div>
            <div><span class="k">FEE</span>${ev.deposit || "추후 안내"}</div>
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
  }

  // 카드 헤더 클릭 → 아코디언 토글
  listContainer.querySelectorAll(".event-header").forEach((header) => {
    header.addEventListener("click", () => {
      const idx = header.dataset.idx;
      const detail = document.getElementById(`event-detail-${idx}`);
      const isOpen = detail.classList.contains("open");
      listContainer.querySelectorAll(".event-detail.open").forEach((d) => d.classList.remove("open"));
      listContainer.querySelectorAll(".event-header").forEach((h) => h.setAttribute("aria-expanded", "false"));
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
  if (!form) return;

  if (select && label) {
    select.addEventListener("change", () => {
      label.textContent = select.value ? `선택한 행사: ${select.value}` : "";
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
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
