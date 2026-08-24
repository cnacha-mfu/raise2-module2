import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, writeBatch, serverTimestamp,
  query, where, getDocs, getDocsFromServer, deleteDoc, limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  FIREBASE_CONFIG_URL, ADMIN_EMAILS, ALLOWED_DOMAINS, CONSULT_DAYS,
  SLOT_MINUTES, QUOTA_PER_WEEK, WEEK_TITLES,
} from "./config.js";

export {
  collection, doc, onSnapshot, writeBatch, serverTimestamp,
  query, where, getDocs, deleteDoc,
  ADMIN_EMAILS, ALLOWED_DOMAINS, CONSULT_DAYS, SLOT_MINUTES, QUOTA_PER_WEEK, WEEK_TITLES,
};

// ค่าเชื่อมต่อมาจาก Firebase Hosting โดยตรง (ดูเหตุผลใน config.js ข้อ 7)
// ต้องรันผ่าน Firebase Hosting หรือ `firebase serve` เท่านั้น
let firebaseConfig;
try {
  const res = await fetch(FIREBASE_CONFIG_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  firebaseConfig = await res.json();
} catch (e) {
  document.body.innerHTML =
    '<div style="max-width:34rem;margin:4rem auto;padding:1.25rem;font-family:sans-serif;'
    + 'background:#1B2452;color:#EEF0F8;border-radius:.8rem;line-height:1.7">'
    + "<h2>เปิดหน้านี้ด้วยวิธีนี้ไม่ได้</h2>"
    + "<p>หน้าเว็บอ่านค่าเชื่อมต่อ Firebase จาก <code>/__/firebase/init.json</code> "
    + "ซึ่งมีเฉพาะตอนเสิร์ฟผ่าน Firebase Hosting</p>"
    + '<p>ใช้งานจริงที่ <a style="color:#E8A43C" href="https://raise2-58508.web.app">raise2-58508.web.app</a> '
    + "หรือทดสอบในเครื่องด้วย <code>cd booking &amp;&amp; firebase serve --project raise2-58508</code></p>"
    + "</div>";
  throw e;
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* ── กันค้างเงียบ ──────────────────────────────────────────────────────────
   Firestore จะไม่โยน error เมื่อต่อฐานข้อมูลไม่ได้ — มันเก็บคำสั่งเขียนไว้ในเครื่อง
   แล้วรอจนกว่าจะติด ทำให้หน้าจอค้างที่ "กำลังจอง" ตลอด · จึงต้องจับเวลาเอง       */

const TIMEOUT_MS = 15000;

export function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer;
  const bell = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error("timeout");
      e.code = "app/timeout";
      reject(e);
    }, ms);
  });
  return Promise.race([promise, bell]).finally(() => clearTimeout(timer));
}

/** อ่านจากเซิร์ฟเวอร์จริง 1 ครั้งเพื่อดูว่าฐานข้อมูลใช้งานได้ไหม */
export async function backendReachable() {
  try {
    await withTimeout(getDocsFromServer(query(collection(db, "slots"), limit(1))), 10000);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/* ── ล็อกอิน ───────────────────────────────────────────────────────────── */

export function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

export function signOutNow() {
  return signOut(auth);
}

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export function isAdmin(user) {
  return !!user && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes((user.email || "").toLowerCase());
}

export function domainAllowed(user) {
  const domain = (user?.email || "").split("@")[1] || "";
  return ALLOWED_DOMAINS.map((d) => d.toLowerCase()).includes(domain.toLowerCase());
}

/** ผู้ใช้คนนี้ใช้ระบบได้ไหม (ผู้สอนเข้าได้เสมอ แม้อีเมลจะอยู่คนละโดเมน) */
export function mayUse(user) {
  return !!user && (isAdmin(user) || domainAllowed(user));
}

/* ── ช่องเวลา ──────────────────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, "0");

/** "09:00" → 540 */
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 540 → "09:00" */
function toHHMM(mins) {
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

/** รหัสช่อง เช่น "2026-08-30_0930" — ใช้เป็นชื่อเอกสาร จึงกันการจองซ้ำได้เอง */
export function slotId(date, time) {
  return `${date}_${time.replace(":", "")}`;
}

/** คืนรายการช่องทั้งหมดของวันหนึ่ง */
export function slotsOfDay(day) {
  const out = [];
  for (let m = toMinutes(day.start); m + SLOT_MINUTES <= toMinutes(day.end); m += SLOT_MINUTES) {
    const time = toHHMM(m);
    out.push({ id: slotId(day.date, time), date: day.date, time, week: day.week, endTime: toHHMM(m + SLOT_MINUTES) });
  }
  return out;
}

/** ทุกช่องของทุกวัน เรียงตามเวลา */
export function allSlots() {
  return CONSULT_DAYS.flatMap(slotsOfDay);
}

/** ช่องนี้ผ่านไปแล้วหรือยัง (เทียบเวลาเครื่องผู้ใช้) */
export function isPast(slot) {
  const [y, mo, d] = slot.date.split("-").map(Number);
  const [h, mi] = slot.time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime() < Date.now();
}

export function quotaId(uid, week) {
  return `${uid}_w${week}`;
}

/* ── จอง / ยกเลิก ──────────────────────────────────────────────────────── */

/**
 * จองหนึ่งช่อง — เขียน 3 เอกสารพร้อมกันในชุดเดียว สำเร็จทั้งหมดหรือไม่สำเร็จเลย
 *   slots/{slotId}        กันคนอื่นจองช่องเดียวกัน (ชื่อเอกสารซ้ำไม่ได้)
 *   appointments/{slotId} รายละเอียดคิว อ่านได้เฉพาะเจ้าของกับผู้สอน
 *   quota/{uid}_w{week}   กันจองเกินโควตาของสัปดาห์นั้น
 */
export async function bookSlot(user, slot, topic) {
  const batch = writeBatch(db);
  batch.set(doc(db, "slots", slot.id), {
    date: slot.date, time: slot.time, week: slot.week,
    byUid: user.uid, createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "appointments", slot.id), {
    date: slot.date, time: slot.time, week: slot.week,
    uid: user.uid, name: user.displayName || "", email: (user.email || "").toLowerCase(),
    topic: topic, createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "quota", quotaId(user.uid, slot.week)), {
    uid: user.uid, week: slot.week, weekStr: String(slot.week),
    slotId: slot.id, createdAt: serverTimestamp(),
  });
  await withTimeout(batch.commit());
}

/** ยกเลิกคิว — ลบทั้ง 3 เอกสารพร้อมกัน */
export async function cancelSlot(slotIdStr, ownerUid, week) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "slots", slotIdStr));
  batch.delete(doc(db, "appointments", slotIdStr));
  batch.delete(doc(db, "quota", quotaId(ownerUid, week)));
  await withTimeout(batch.commit());
}

/** ผู้สอนปิดช่วงเวลาไม่ให้ใครจอง */
export async function blockSlot(user, slot) {
  const batch = writeBatch(db);
  batch.set(doc(db, "slots", slot.id), {
    date: slot.date, time: slot.time, week: slot.week,
    byUid: user.uid, createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "appointments", slot.id), {
    date: slot.date, time: slot.time, week: slot.week,
    uid: user.uid, name: "— ปิดโดยผู้สอน —", email: (user.email || "").toLowerCase(),
    topic: "ปิดช่วงเวลานี้", blocked: true, createdAt: serverTimestamp(),
  });
  await withTimeout(batch.commit());
}

/* ── ตัวช่วยแสดงผล ─────────────────────────────────────────────────────── */

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const TH_DAYS = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];

/** "2026-08-30" → "อาทิตย์ 30 ส.ค. 2569" */
export function thaiDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${TH_DAYS[dt.getDay()]} ${d} ${TH_MONTHS[m - 1]} ${y + 543}`;
}

export function dayConfig(iso) {
  return CONSULT_DAYS.find((d) => d.date === iso) || null;
}

/** แสดงข้อความ error ของ Firebase เป็นภาษาคน */
export function humanError(err) {
  const code = err?.code || "";
  if (code === "permission-denied") {
    return "ระบบไม่อนุญาต — ช่องนี้อาจถูกคนอื่นจองไปพอดี หรือคุณจองครบโควตาของสัปดาห์นี้แล้ว กดรีเฟรชแล้วลองใหม่";
  }
  if (code === "app/timeout") {
    return "ระบบไม่ตอบภายใน 15 วินาที — มักเกิดจากฐานข้อมูลของโปรเจกต์ยังไม่ถูกสร้าง "
      + "หรืออินเทอร์เน็ตหลุด · คิวยังไม่ถูกบันทึก ให้แจ้งผู้สอนแล้วลองใหม่";
  }
  if (code === "unavailable" || code === "failed-precondition") {
    return "ต่อฐานข้อมูลไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้สอน";
  }
  if (code === "auth/operation-not-allowed" || code === "auth/configuration-not-found") {
    return "ระบบยังไม่ได้เปิดการล็อกอินด้วย Google — แจ้งผู้สอนให้เปิดที่ Firebase Console → Authentication → Sign-in method → Google → Enable";
  }
  if (code === "auth/unauthorized-domain") {
    return "โดเมนของหน้าเว็บนี้ยังไม่ได้รับอนุญาตให้ล็อกอิน — แจ้งผู้สอนให้เพิ่มใน Firebase Console → Authentication → Settings → Authorized domains";
  }
  if (code === "auth/popup-blocked") {
    return "เบราว์เซอร์บล็อกหน้าต่างล็อกอิน — อนุญาต pop-up ของเว็บนี้แล้วลองใหม่";
  }
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "หน้าต่างล็อกอินถูกปิดไปก่อน ลองกดเข้าสู่ระบบอีกครั้ง";
  }
  return err?.message || "เกิดข้อผิดพลาดที่ไม่รู้จัก";
}
