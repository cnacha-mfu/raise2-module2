/* =========================================================
   LeaveEasy prototype — การทำงานของทุกหน้า
   ทุกการเพิ่ม/แก้/เปลี่ยนสถานะ เกิดขึ้นกับตัวแปรในหน่วยความจำเท่านั้น
   (ดูคำอธิบายใน js/data.js) — ไม่มี localStorage ไม่มีฐานข้อมูล
   ========================================================= */
"use strict";

// ── สถานะ 3 ค่า: รอพิจารณา → อนุมัติ / ไม่อนุมัติ (สองค่าหลังเป็นปลายทาง) ──
const STATUS_LIST = ["รอพิจารณา", "อนุมัติ", "ไม่อนุมัติ"];
const STATUS_CLASS = {
  "รอพิจารณา": "badge-yellow",
  "อนุมัติ": "badge-green",
  "ไม่อนุมัติ": "badge-red"
};

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
  if (page === "leave-requests") initRequestList();
  else if (page === "new-leave-request") initNewRequest();
  else if (page === "leave-request-detail") initRequestDetail();
  else if (page === "leave-types") initLeaveTypes();
  else if (page === "dashboard") initDashboard();
});

/* ───────────────────────────────────────────
   หน้าที่ 1 — รายการใบลา (leave-requests.html)
   ─────────────────────────────────────────── */
function initRequestList() {
  const params = new URLSearchParams(window.location.search);
  const statusFilter = params.get("status");

  // รับใบใหม่ที่หน้าฟอร์มส่งต่อมาทาง URL → เก็บลงหน่วยความจำ แล้วล้าง URL ทันที
  // (ล้าง URL เพื่อให้การกดรีเฟรชทำให้ข้อมูลหายจริง ตามที่แบนเนอร์บอกไว้)
  const newParam = params.get("new");
  if (newParam) {
    try {
      const r = JSON.parse(newParam);
      if (r && r.id) { r.__isNew = true; leaveRequests.push(r); }
    } catch (e) { /* ข้อมูลที่ส่งมาอ่านไม่ได้ ก็ไม่เพิ่ม */ }
    const cleanUrl = window.location.pathname + (statusFilter ? "?status=" + encodeURIComponent(statusFilter) : "");
    history.replaceState(null, "", cleanUrl);
  }

  const noticeEl = document.getElementById("filter-notice");
  if (statusFilter && noticeEl) {
    noticeEl.innerHTML =
      "กำลังแสดงเฉพาะสถานะ " + badgeHtml(statusFilter) +
      ' <a href="leave-requests.html">แสดงทุกสถานะ</a>';
    noticeEl.style.display = "flex";
  }

  const list = leaveRequests
    .filter(function (r) { return !statusFilter || r.status === statusFilter; })
    .slice()
    .sort(function (a, b) {
      if (a.__isNew !== b.__isNew) return a.__isNew ? -1 : 1;   // รายการที่เพิ่งกรอกอยู่บนสุดเสมอ
      return b.createdAt.localeCompare(a.createdAt);
    });

  const tbody = document.getElementById("request-rows");
  const emptyEl = document.getElementById("empty-message");
  const tableWrap = document.getElementById("request-table-wrap");

  if (list.length === 0) {
    tableWrap.style.display = "none";
    emptyEl.style.display = "block";
    emptyEl.textContent = statusFilter
      ? "ไม่มีใบขอลาที่อยู่ในสถานะ " + statusFilter
      : "ยังไม่มีใบขอลาในระบบ";
    return;
  }

  tbody.innerHTML = list.map(function (r) {
    return (
      '<tr class="row-link" data-id="' + escapeHtml(r.id) + '">' +
      "<td>" + escapeHtml(r.title) + "</td>" +
      "<td>" + escapeHtml(r.leaveTypeName) + "</td>" +
      "<td>" + badgeHtml(r.status) + "</td>" +
      "<td>" + escapeHtml(r.requesterName) + "</td>" +
      "<td>" + escapeHtml(r.startDate) + " → " + escapeHtml(r.endDate) + "</td>" +
      "</tr>"
    );
  }).join("");

  tbody.querySelectorAll("tr.row-link").forEach(function (tr) {
    tr.addEventListener("click", function () {
      window.location.href = "leave-request-detail.html?id=" + encodeURIComponent(tr.dataset.id);
    });
  });
}

/* ───────────────────────────────────────────
   หน้าที่ 2 — ยื่นใบลาใหม่ (new-leave-request.html)
   ─────────────────────────────────────────── */
function initNewRequest() {
  const select = document.getElementById("leave-type");
  leaveTypes.forEach(function (lt) {
    const opt = document.createElement("option");
    opt.value = lt.id;
    opt.textContent = lt.name;
    select.appendChild(opt);
  });

  const form = document.getElementById("new-request-form");
  const errorBox = document.getElementById("form-error");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const fields = {
      title: document.getElementById("title"),
      reason: document.getElementById("reason"),
      leaveType: select,
      startDate: document.getElementById("start-date"),
      endDate: document.getElementById("end-date")
    };
    const labels = {
      title: "หัวข้อ", reason: "เหตุผลการลา", leaveType: "ประเภทการลา",
      startDate: "วันที่เริ่มลา", endDate: "วันที่สิ้นสุด"
    };

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
    if (fields.endDate.value < fields.startDate.value) {
      errorBox.textContent = "วันที่สิ้นสุดต้องไม่มาก่อนวันที่เริ่มลา";
      errorBox.classList.add("show");
      fields.endDate.classList.add("field-error");
      return;
    }
    errorBox.classList.remove("show");

    const lt = leaveTypes.find(function (x) { return x.id === select.value; });
    const request = {
      id: "lr" + Date.now(),
      title: fields.title.value.trim(),
      reason: fields.reason.value.trim(),
      status: "รอพิจารณา",                 // ใบใหม่เริ่มที่ "รอพิจารณา" เสมอ ระบบตั้งให้อัตโนมัติ
      requesterId: "u001", requesterName: "สมชาย ใจดี",   // ยังไม่มีล็อกอิน → ใช้ผู้ขอลาตัวอย่าง
      approverId: "", approverName: "",
      leaveTypeId: lt.id, leaveTypeName: lt.name,
      startDate: fields.startDate.value,
      endDate: fields.endDate.value,
      createdAt: nowText()
    };

    // ส่งใบใหม่ไปให้หน้ารายการทาง URL (หน้ารายการจะอ่านแล้วล้าง URL ทิ้ง)
    window.location.href = "leave-requests.html?new=" + encodeURIComponent(JSON.stringify(request));
  });
}

/* ───────────────────────────────────────────
   หน้าที่ 3 — รายละเอียดใบลา (leave-request-detail.html)
   ─────────────────────────────────────────── */
function initRequestDetail() {
  const id = getParam("id");
  const request = leaveRequests.find(function (r) { return r.id === id; });
  const notFoundEl = document.getElementById("not-found");
  const contentEl = document.getElementById("detail-content");

  if (!request) {
    contentEl.style.display = "none";
    notFoundEl.style.display = "block";
    return;
  }

  document.getElementById("d-title").textContent = request.title;
  document.getElementById("d-reason").textContent = request.reason;
  document.getElementById("d-leave-type").textContent = request.leaveTypeName;
  document.getElementById("d-dates").textContent = request.startDate + " → " + request.endDate;
  document.getElementById("d-requester").textContent = request.requesterName;
  document.getElementById("d-approver").textContent = request.approverName || "ยังไม่ได้กำหนดผู้อนุมัติ";
  document.getElementById("d-created").textContent = request.createdAt;

  renderStatusArea(request);
  renderApprovals(id);

  // ส่งความเห็นใหม่ (เก็บในหน่วยความจำเท่านั้น)
  const approvalForm = document.getElementById("approval-form");
  const approvalInput = document.getElementById("approval-message");
  const approvalError = document.getElementById("approval-error");
  approvalForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const message = approvalInput.value.trim();
    if (!message) {
      approvalError.textContent = "พิมพ์ข้อความก่อนกดส่ง — ส่งข้อความว่างเปล่าไม่ได้";
      approvalError.classList.add("show");
      return;
    }
    approvalError.classList.remove("show");
    if (!approvals[id]) approvals[id] = [];
    approvals[id].push({
      authorId: "u002", authorName: "สมหญิง รักงาน",   // ยังไม่มีล็อกอิน → ใช้ผู้เขียนตัวอย่าง
      message: message,
      createdAt: nowText()
    });
    approvalInput.value = "";
    renderApprovals(id);
  });
}

function renderStatusArea(request) {
  document.getElementById("d-status").innerHTML = badgeHtml(request.status);
  const actionEl = document.getElementById("status-action");

  if (request.status === "รอพิจารณา") {
    actionEl.innerHTML = "";

    const approveBtn = document.createElement("button");
    approveBtn.className = "btn";
    approveBtn.textContent = "✔ อนุมัติ";
    approveBtn.addEventListener("click", function () {
      request.status = "อนุมัติ";   // แก้เฉพาะช่อง status ช่องอื่นคงเดิม
      renderStatusArea(request);
    });

    const rejectBtn = document.createElement("button");
    rejectBtn.className = "btn btn-danger";
    rejectBtn.textContent = "✘ ไม่อนุมัติ";
    rejectBtn.addEventListener("click", function () {
      // กฎของระบบ: จะไม่อนุมัติได้ ต้องมีความเห็นในใบนี้อย่างน้อย 1 รายการก่อน
      const items = approvals[request.id] || [];
      if (items.length === 0) {
        window.alert("ยังไม่อนุมัติไม่ได้ — ต้องเขียนความเห็นบอกเหตุผลไว้ในใบนี้อย่างน้อย 1 รายการก่อน");
        return;
      }
      request.status = "ไม่อนุมัติ";   // แก้เฉพาะช่อง status ช่องอื่นคงเดิม
      renderStatusArea(request);
    });

    const note = document.createElement("span");
    note.className = "status-note";
    note.textContent = "ตัดสินได้ครั้งเดียว — อนุมัติหรือไม่อนุมัติแล้ว เปลี่ยนต่อไม่ได้";

    actionEl.appendChild(approveBtn);
    actionEl.appendChild(rejectBtn);
    actionEl.appendChild(note);
  } else {
    actionEl.innerHTML = '<span class="status-note">ใบนี้พิจารณาแล้ว — สถานะ "' +
      escapeHtml(request.status) + '" เป็นปลายทาง เปลี่ยนต่อไม่ได้</span>';
  }
}

function renderApprovals(requestId) {
  const listEl = document.getElementById("approval-list");
  const emptyEl = document.getElementById("approval-empty");
  const items = (approvals[requestId] || [])
    .slice()
    .sort(function (a, b) { return a.createdAt.localeCompare(b.createdAt); }); // เก่าไปใหม่

  if (items.length === 0) {
    listEl.innerHTML = "";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";
  listEl.innerHTML = items.map(function (a) {
    return (
      "<li>" +
      '<div class="who">' + escapeHtml(a.authorName) +
      '<span class="when">' + escapeHtml(a.createdAt) + "</span></div>" +
      "<div>" + escapeHtml(a.message) + "</div>" +
      "</li>"
    );
  }).join("");
}

/* ───────────────────────────────────────────
   หน้าที่ 4 — จัดการประเภทการลา (leave-types.html)
   ─────────────────────────────────────────── */
function initLeaveTypes() {
  renderLeaveTypeTable();

  const form = document.getElementById("leave-type-form");
  const input = document.getElementById("leave-type-name");
  const errorBox = document.getElementById("leave-type-error");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) {
      errorBox.textContent = "พิมพ์ชื่อประเภทการลาก่อนกดเพิ่ม — เพิ่มชื่อว่างเปล่าไม่ได้";
      errorBox.classList.add("show");
      return;
    }
    if (leaveTypes.some(function (lt) { return lt.name === name; })) {
      errorBox.textContent = "มีประเภทการลาชื่อ “" + name + "” อยู่แล้ว";
      errorBox.classList.add("show");
      return;
    }
    errorBox.classList.remove("show");
    leaveTypes.push({ id: "lt" + Date.now(), name: name });
    input.value = "";
    renderLeaveTypeTable();
  });
}

function renderLeaveTypeTable() {
  const tbody = document.getElementById("leave-type-rows");
  tbody.innerHTML = leaveTypes.map(function (lt) {
    const used = leaveRequests.filter(function (r) { return r.leaveTypeId === lt.id; }).length;
    return (
      '<tr data-id="' + escapeHtml(lt.id) + '">' +
      "<td>" + escapeHtml(lt.name) + "</td>" +
      "<td>" + used + " ใบ</td>" +
      '<td><button class="btn btn-secondary btn-sm act-edit">แก้ไข</button> ' +
      '<button class="btn btn-danger btn-sm act-delete">ลบ</button></td>' +
      "</tr>"
    );
  }).join("");

  tbody.querySelectorAll("tr").forEach(function (tr) {
    const lt = leaveTypes.find(function (x) { return x.id === tr.dataset.id; });
    tr.querySelector(".act-edit").addEventListener("click", function () {
      const newName = window.prompt("แก้ชื่อประเภทการลาเป็น:", lt.name);
      if (newName && newName.trim()) {
        lt.name = newName.trim();
        renderLeaveTypeTable();
      }
    });
    tr.querySelector(".act-delete").addEventListener("click", function () {
      if (window.confirm("ลบประเภทการลา “" + lt.name + "” ใช่ไหม?")) {
        const i = leaveTypes.indexOf(lt);
        if (i >= 0) leaveTypes.splice(i, 1);
        renderLeaveTypeTable();
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
  grid.innerHTML = STATUS_LIST.map(function (status) {
    const count = leaveRequests.filter(function (r) { return r.status === status; }).length;
    return (
      '<a class="stat-box" href="leave-requests.html?status=' + encodeURIComponent(status) + '">' +
      '<div class="num">' + count + "</div>" +
      '<div class="lbl">' + badgeHtml(status) + "</div>" +
      "</a>"
    );
  }).join("");

  const latest = leaveRequests
    .slice()
    .sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); })
    .slice(0, 5);

  const tbody = document.getElementById("latest-rows");
  tbody.innerHTML = latest.map(function (r) {
    return (
      '<tr class="row-link" data-id="' + escapeHtml(r.id) + '">' +
      "<td>" + escapeHtml(r.title) + "</td>" +
      "<td>" + badgeHtml(r.status) + "</td>" +
      "<td>" + escapeHtml(r.createdAt) + "</td>" +
      "</tr>"
    );
  }).join("");
  tbody.querySelectorAll("tr.row-link").forEach(function (tr) {
    tr.addEventListener("click", function () {
      window.location.href = "leave-request-detail.html?id=" + encodeURIComponent(tr.dataset.id);
    });
  });
}
