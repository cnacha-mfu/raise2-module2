// ============================================================================
//  ⚙️  ตั้งค่าระบบจองคิว Consult — แก้ได้เฉพาะไฟล์นี้ไฟล์เดียว
//  แก้เสร็จแล้วสั่ง deploy ใหม่:  npm run deploy   (ดู booking/README.md)
// ============================================================================

// ── 1. อีเมลผู้สอน (เห็นรายการจองทั้งหมด · ยกเลิกคิวคนอื่นได้ · ปิดช่วงเวลาได้) ──
//    ⚠️ แก้ที่นี่แล้ว "ต้องแก้ใน booking/firestore.rules ให้ตรงกันด้วย" มิฉะนั้นหน้า admin จะเปิดไม่ได้
export const ADMIN_EMAILS = [
  "cnacha@mfu.ac.th",            // ⚠️ ตรวจว่าสะกดตรงกับอีเมลจริงของคุณ ถ้าไม่ตรงหน้า admin จะเปิดไม่ได้
  "mfu.claude.project@gmail.com", // บัญชีสำรอง — เผื่อบรรทัดบนสะกดไม่ตรง จะได้ยังเข้าหน้า admin ได้
];

// ── 2. โดเมนอีเมลที่จองได้ ──
export const ALLOWED_DOMAINS = ["mfu.ac.th", "lamduan.mfu.ac.th"];

// ── 3. จำนวนคิวที่จองได้ต่อคนต่อสัปดาห์ ──
export const QUOTA_PER_WEEK = 1;

// ── 4. ความยาวของแต่ละช่อง (นาที) ──
export const SLOT_MINUTES = 30;

// ── 5. วันและเวลาที่เปิดให้จอง ──
//    เพิ่มวันได้ด้วยการเพิ่มบรรทัดในรายการนี้ · ลบวันได้ด้วยการลบบรรทัด
//    date ต้องเป็นรูปแบบ YYYY-MM-DD (ค.ศ.) · week คือสัปดาห์ของคอร์ส
export const CONSULT_DAYS = [
  { date: "2026-08-30", week: 6, label: "อาทิตย์ 30 ส.ค.",  start: "09:00", end: "12:00" },
  { date: "2026-09-01", week: 6, label: "อังคาร 1 ก.ย.",    start: "09:00", end: "12:00" },
  { date: "2026-09-06", week: 7, label: "อาทิตย์ 6 ก.ย.",   start: "09:00", end: "12:00" },
  { date: "2026-09-08", week: 7, label: "อังคาร 8 ก.ย.",    start: "09:00", end: "12:00" },
  { date: "2026-09-13", week: 8, label: "อาทิตย์ 13 ก.ย.",  start: "09:00", end: "12:00" },
  { date: "2026-09-15", week: 8, label: "อังคาร 15 ก.ย.",   start: "09:00", end: "12:00" },
  { date: "2026-09-20", week: 9, label: "อาทิตย์ 20 ก.ย.",  start: "09:00", end: "12:00" },
  { date: "2026-09-22", week: 9, label: "อังคาร 22 ก.ย.",   start: "09:00", end: "12:00" },
];

// ── 6. ชื่อหัวข้อของแต่ละสัปดาห์ (ใช้แสดงบนหน้าจอเท่านั้น) ──
export const WEEK_TITLES = {
  6: "Setup + Firestore",
  7: "CRUD + ล็อกอิน + ขึ้นออนไลน์",
  8: "ปิดข้อมูล + ผู้ช่วย AI + Reviewer",
  9: "Tester + ปิด Module",
};

// ── 7. ค่าเชื่อมต่อ Firebase — ไม่ใช่ความลับ ห้ามพยายามซ่อน ──
//    สิ่งที่ป้องกันข้อมูลจริงคือ Security Rules ใน booking/firestore.rules
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDeYAgKTPMiT1gaWK4sRQhVHa3MfTXFvpM",
  authDomain: "raise2-58508.firebaseapp.com",
  projectId: "raise2-58508",
  storageBucket: "raise2-58508.firebasestorage.app",
  messagingSenderId: "889930133815",
  appId: "1:889930133815:web:af0b14c742edada32f6ab2",
};
