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

async function renderEventList() {
  const el = document.getElementById("event-list");
  if (!el) return;
  const events = await loadJSON("data/events.json");

  if (events.length === 0) {
    el.innerHTML = `<div class="events-empty">현재 등록된 행사가 없습니다. 다음 모집 소식을 기다려 주세요.</div>`;
    return;
  }

  el.innerHTML = events
    .map((ev) => {
      const statusClass = STATUS_CLASS[ev.status] || "upcoming";
      const closed = ev.status === "마감";
      return `
      <div class="event-card ${closed ? "closed" : ""}">
        <div class="event-main">
          <span class="event-status ${statusClass}">${ev.status}</span>
          <h3>${ev.title}</h3>
          <div class="event-meta">
            <div><span class="k">DATE</span>${ev.date}</div>
            <div><span class="k">PLACE</span>${ev.place}</div>
            <div><span class="k">FEE</span>${ev.deposit || "추후 안내"}</div>
            ${ev.deadline ? `<div><span class="k">DEADLINE</span>${ev.deadline}까지</div>` : ""}
          </div>
          ${ev.note ? `<div class="event-note">${ev.note}</div>` : ""}
        </div>
        <div class="event-action">
          <button class="btn" type="button" data-event-title="${ev.title}" ${closed ? "disabled" : ""}>
            ${closed ? "모집 마감" : "이 행사에 신청하기"}
          </button>
        </div>
      </div>`;
    })
    .join("");

  const select = document.getElementById("event");
  if (select) {
    select.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());
    events.forEach((ev) => {
      const opt = document.createElement("option");
      opt.value = ev.title;
      opt.textContent = `${ev.title} (${ev.date})${ev.status === "마감" ? " - 마감" : ""}`;
      if (ev.status === "마감") opt.disabled = true;
      select.appendChild(opt);
    });
  }

  el.querySelectorAll("button[data-event-title]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const title = btn.dataset.eventTitle;
      if (select) select.value = title;
      const label = document.getElementById("selected-event-label");
      if (label) label.textContent = `선택한 행사: ${title}`;
      document.getElementById("apply-section").scrollIntoView({ behavior: "smooth", block: "start" });
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
