/* =========================================================
   FixIt prototype — การทำงานของทุกหน้า
   ทุกการเพิ่ม/แก้/เปลี่ยนสถานะ เกิดขึ้นกับตัวแปรในหน่วยความจำเท่านั้น
   (ดูคำอธิบายใน js/data.js) — ไม่มี localStorage ไม่มีฐานข้อมูล
   ========================================================= */
"use strict";

// ── สถานะ 4 ค่า เปลี่ยนได้ทีละขั้นตามลำดับนี้เท่านั้น ──
const STATUS_ORDER = ["แจ้งใหม่", "รับเรื่องแล้ว", "กำลังซ่อม", "เสร็จสิ้น"];
const STATUS_CLASS = {
  "แจ้งใหม่": "badge-gray",
  "รับเรื่องแล้ว": "badge-blue",
  "กำลังซ่อม": "badge-yellow",
  "เสร็จสิ้น": "badge-green"
};

function nextStatus(status) {
  const i = STATUS_ORDER.indexOf(status);
  return i >= 0 && i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null;
}

function badgeHtml(status) {
  return '<span class="badge ' + (STATUS_CLASS[status] || "badge-gray") + '">' + escapeHtml(status) + "</span>";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function nowText() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

document.addEventListener("DOMContentLoaded", function () {
  const page = document.body.dataset.page;
  if (page === "tickets") initTicketList();
  else if (page === "new-ticket") initNewTicket();
  else if (page === "ticket-detail") initTicketDetail();
  else if (page === "categories") initCategories();
  else if (page === "dashboard") initDashboard();
});

/* ───────────────────────────────────────────
   หน้าที่ 1 — รายการใบแจ้งซ่อม (tickets.html)
   ─────────────────────────────────────────── */
function initTicketList() {
  const params = new URLSearchParams(window.location.search);
  const statusFilter = params.get("status");

  // รับใบใหม่ที่หน้าฟอร์มส่งต่อมาทาง URL → เก็บลงหน่วยความจำ แล้วล้าง URL ทันที
  // (ล้าง URL เพื่อให้การกดรีเฟรชทำให้ข้อมูลหายจริง ตามที่แบนเนอร์บอกไว้)
  const newParam = params.get("new");
  if (newParam) {
    try {
      const t = JSON.parse(newParam);
      if (t && t.id) { t.__isNew = true; tickets.push(t); }
    } catch (e) { /* ข้อมูลที่ส่งมาอ่านไม่ได้ ก็ไม่เพิ่ม */ }
    const cleanUrl = window.location.pathname + (statusFilter ? "?status=" + encodeURIComponent(statusFilter) : "");
    history.replaceState(null, "", cleanUrl);
  }

  const noticeEl = document.getElementById("filter-notice");
  if (statusFilter && noticeEl) {
    noticeEl.innerHTML =
      "กำลังแสดงเฉพาะสถานะ " + badgeHtml(statusFilter) +
      ' <a href="tickets.html">แสดงทุกสถานะ</a>';
    noticeEl.style.display = "flex";
  }

  const list = tickets
    .filter(function (t) { return !statusFilter || t.status === statusFilter; })
    .slice()
    .sort(function (a, b) {
      if (a.__isNew !== b.__isNew) return a.__isNew ? -1 : 1;   // รายการที่เพิ่งกรอกอยู่บนสุดเสมอ
      return b.createdAt.localeCompare(a.createdAt);
    });

  const tbody = document.getElementById("ticket-rows");
  const emptyEl = document.getElementById("empty-message");
  const tableWrap = document.getElementById("ticket-table-wrap");

  if (list.length === 0) {
    tableWrap.style.display = "none";
    emptyEl.style.display = "block";
    emptyEl.textContent = statusFilter
      ? "ไม่มีใบแจ้งซ่อมที่อยู่ในสถานะ " + statusFilter
      : "ยังไม่มีใบแจ้งซ่อมในระบบ";
    return;
  }

  tbody.innerHTML = list.map(function (t) {
    return (
      '<tr class="row-link" data-id="' + escapeHtml(t.id) + '">' +
      "<td>" + escapeHtml(t.title) + "</td>" +
      "<td>" + escapeHtml(t.categoryName) + "</td>" +
      "<td>" + badgeHtml(t.status) + "</td>" +
      "<td>" + escapeHtml(t.reporterName) + "</td>" +
      "<td>" + escapeHtml(t.createdAt) + "</td>" +
      "</tr>"
    );
  }).join("");

  tbody.querySelectorAll("tr.row-link").forEach(function (tr) {
    tr.addEventListener("click", function () {
      window.location.href = "ticket-detail.html?id=" + encodeURIComponent(tr.dataset.id);
    });
  });
}

/* ───────────────────────────────────────────
   หน้าที่ 2 — แจ้งซ่อมใหม่ (new-ticket.html)
   ─────────────────────────────────────────── */
function initNewTicket() {
  const select = document.getElementById("category");
  categories.forEach(function (c) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });

  const form = document.getElementById("new-ticket-form");
  const errorBox = document.getElementById("form-error");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const fields = {
      title: document.getElementById("title"),
      detail: document.getElementById("detail"),
      category: select,
      place: document.getElementById("place")
    };
    const labels = { title: "หัวข้อ", detail: "รายละเอียด", category: "หมวดหมู่", place: "สถานที่" };

    const missing = [];
    Object.keys(fields).forEach(function (key) {
      const el = fields[key];
      const empty = !el.value.trim();
      el.classList.toggle("field-error", empty);
      if (empty) missing.push(labels[key]);
    });

    if (missing.length > 0) {
      errorBox.textContent = "กรอกไม่ครบ — ช่องที่ยังว่างอยู่: " + missing.join(" · ");
      errorBox.classList.add("show");
      return;
    }
    errorBox.classList.remove("show");

    const cat = categories.find(function (c) { return c.id === select.value; });
    const ticket = {
      id: "t" + Date.now(),
      title: fields.title.value.trim(),
      detail: fields.detail.value.trim(),
      location: fields.place.value.trim(),
      status: "แจ้งใหม่",                 // ใบใหม่เริ่มที่ "แจ้งใหม่" เสมอ ระบบตั้งให้อัตโนมัติ
      reporterId: "u001", reporterName: "สมชาย ใจดี",   // ยังไม่มีล็อกอิน → ใช้ผู้แจ้งตัวอย่าง
      assigneeId: "", assigneeName: "",
      categoryId: cat.id, categoryName: cat.name,
      createdAt: nowText()
    };

    // ส่งใบใหม่ไปให้หน้ารายการทาง URL (หน้ารายการจะอ่านแล้วล้าง URL ทิ้ง)
    window.location.href = "tickets.html?new=" + encodeURIComponent(JSON.stringify(ticket));
  });
}

/* ───────────────────────────────────────────
   หน้าที่ 3 — รายละเอียดใบแจ้งซ่อม (ticket-detail.html)
   ─────────────────────────────────────────── */
function initTicketDetail() {
  const id = getParam("id");
  const ticket = tickets.find(function (t) { return t.id === id; });
  const notFoundEl = document.getElementById("not-found");
  const contentEl = document.getElementById("detail-content");

  if (!ticket) {
    contentEl.style.display = "none";
    notFoundEl.style.display = "block";
    return;
  }

  document.getElementById("d-title").textContent = ticket.title;
  document.getElementById("d-detail").textContent = ticket.detail;
  document.getElementById("d-category").textContent = ticket.categoryName;
  document.getElementById("d-place").textContent = ticket.location;
  document.getElementById("d-reporter").textContent = ticket.reporterName;
  document.getElementById("d-assignee").textContent = ticket.assigneeName || "ยังไม่ได้มอบหมาย";
  document.getElementById("d-created").textContent = ticket.createdAt;

  renderStatusArea(ticket);
  renderComments(id);

  // ส่งความคืบหน้าใหม่ (เก็บในหน่วยความจำเท่านั้น)
  const commentForm = document.getElementById("comment-form");
  const commentInput = document.getElementById("comment-message");
  const commentError = document.getElementById("comment-error");
  commentForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const message = commentInput.value.trim();
    if (!message) {
      commentError.textContent = "พิมพ์ข้อความก่อนกดส่ง — ส่งข้อความว่างเปล่าไม่ได้";
      commentError.classList.add("show");
      return;
    }
    commentError.classList.remove("show");
    if (!comments[id]) comments[id] = [];
    comments[id].push({
      authorId: "u002", authorName: "สมหญิง รักงาน",   // ยังไม่มีล็อกอิน → ใช้ผู้เขียนตัวอย่าง
      message: message,
      createdAt: nowText()
    });
    commentInput.value = "";
    renderComments(id);
  });
}

function renderStatusArea(ticket) {
  document.getElementById("d-status").innerHTML = badgeHtml(ticket.status);
  const actionEl = document.getElementById("status-action");
  const next = nextStatus(ticket.status);

  if (next) {
    actionEl.innerHTML = "";
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "เปลี่ยนสถานะเป็น " + next;
    btn.addEventListener("click", function () {
      ticket.status = next;   // แก้เฉพาะช่อง status ช่องอื่นคงเดิม
      renderStatusArea(ticket);
    });
    actionEl.appendChild(btn);
    const note = document.createElement("span");
    note.className = "status-note";
    note.textContent = "เปลี่ยนได้ทีละขั้นตามลำดับ ไม่ข้ามขั้น ไม่ย้อนกลับ";
    actionEl.appendChild(note);
  } else {
    actionEl.innerHTML = '<span class="status-note">งานนี้ปิดแล้ว — สถานะ "เสร็จสิ้น" เป็นปลายทาง เปลี่ยนต่อไม่ได้</span>';
  }
}

function renderComments(ticketId) {
  const listEl = document.getElementById("comment-list");
  const emptyEl = document.getElementById("comment-empty");
  const items = (comments[ticketId] || [])
    .slice()
    .sort(function (a, b) { return a.createdAt.localeCompare(b.createdAt); }); // เก่าไปใหม่

  if (items.length === 0) {
    listEl.innerHTML = "";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";
  listEl.innerHTML = items.map(function (c) {
    return (
      "<li>" +
      '<div class="who">' + escapeHtml(c.authorName) +
      '<span class="when">' + escapeHtml(c.createdAt) + "</span></div>" +
      "<div>" + escapeHtml(c.message) + "</div>" +
      "</li>"
    );
  }).join("");
}

/* ───────────────────────────────────────────
   หน้าที่ 4 — จัดการหมวดหมู่ (categories.html)
   ─────────────────────────────────────────── */
function initCategories() {
  renderCategoryTable();

  const form = document.getElementById("category-form");
  const input = document.getElementById("category-name");
  const errorBox = document.getElementById("category-error");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) {
      errorBox.textContent = "พิมพ์ชื่อหมวดหมู่ก่อนกดเพิ่ม — เพิ่มชื่อว่างเปล่าไม่ได้";
      errorBox.classList.add("show");
      return;
    }
    if (categories.some(function (c) { return c.name === name; })) {
      errorBox.textContent = "มีหมวดหมู่ชื่อ “" + name + "” อยู่แล้ว";
      errorBox.classList.add("show");
      return;
    }
    errorBox.classList.remove("show");
    categories.push({ id: "c" + Date.now(), name: name });
    input.value = "";
    renderCategoryTable();
  });
}

function renderCategoryTable() {
  const tbody = document.getElementById("category-rows");
  tbody.innerHTML = categories.map(function (c) {
    const used = tickets.filter(function (t) { return t.categoryId === c.id; }).length;
    return (
      '<tr data-id="' + escapeHtml(c.id) + '">' +
      "<td>" + escapeHtml(c.name) + "</td>" +
      "<td>" + used + " ใบ</td>" +
      '<td><button class="btn btn-secondary btn-sm act-edit">แก้ไข</button> ' +
      '<button class="btn btn-danger btn-sm act-delete">ลบ</button></td>' +
      "</tr>"
    );
  }).join("");

  tbody.querySelectorAll("tr").forEach(function (tr) {
    const cat = categories.find(function (c) { return c.id === tr.dataset.id; });
    tr.querySelector(".act-edit").addEventListener("click", function () {
      const newName = window.prompt("แก้ชื่อหมวดหมู่เป็น:", cat.name);
      if (newName && newName.trim()) {
        cat.name = newName.trim();
        renderCategoryTable();
      }
    });
    tr.querySelector(".act-delete").addEventListener("click", function () {
      if (window.confirm("ลบหมวดหมู่ “" + cat.name + "” ใช่ไหม?")) {
        const i = categories.indexOf(cat);
        if (i >= 0) categories.splice(i, 1);
        renderCategoryTable();
      }
    });
  });
}

/* ───────────────────────────────────────────
   หน้าที่ 5 — แดชบอร์ดสรุป (dashboard.html)
   ─────────────────────────────────────────── */
function initDashboard() {
  // นับจากข้อมูลจริงในหน่วยความจำ ไม่ใช่ตัวเลขที่พิมพ์ค้างไว้
  const grid = document.getElementById("stat-grid");
  grid.innerHTML = STATUS_ORDER.map(function (status) {
    const count = tickets.filter(function (t) { return t.status === status; }).length;
    return (
      '<a class="stat-box" href="tickets.html?status=' + encodeURIComponent(status) + '">' +
      '<div class="num">' + count + "</div>" +
      '<div class="lbl">' + badgeHtml(status) + "</div>" +
      "</a>"
    );
  }).join("");

  const latest = tickets
    .slice()
    .sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); })
    .slice(0, 5);

  const tbody = document.getElementById("latest-rows");
  tbody.innerHTML = latest.map(function (t) {
    return (
      '<tr class="row-link" data-id="' + escapeHtml(t.id) + '">' +
      "<td>" + escapeHtml(t.title) + "</td>" +
      "<td>" + badgeHtml(t.status) + "</td>" +
      "<td>" + escapeHtml(t.createdAt) + "</td>" +
      "</tr>"
    );
  }).join("");
  tbody.querySelectorAll("tr.row-link").forEach(function (tr) {
    tr.addEventListener("click", function () {
      window.location.href = "ticket-detail.html?id=" + encodeURIComponent(tr.dataset.id);
    });
  });
}
