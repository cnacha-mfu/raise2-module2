/* =========================================================
   LeaveEasy prototype — ข้อมูลปลอม (mock data)
   ข้อมูลทั้งหมดอยู่ใน "หน่วยความจำ" (ตัวแปร JavaScript) เท่านั้น
   ไม่มีการบันทึกลงเครื่องหรือฐานข้อมูลใด ๆ ทั้งสิ้น
   → รีเฟรชหน้าเมื่อไร ข้อมูลจะกลับเป็นชุดเริ่มต้นนี้เสมอ
   นี่คือความตั้งใจ: ให้เห็นว่าระบบที่ "จำไม่ได้" เป็นอย่างไร
   ก่อนที่ Module 2 จะต่อฐานข้อมูลจริง (Firestore)
   ชื่อคนทุกชื่อเป็นชื่อสมมติ · โครงสร้างช่องข้อมูลตรงตาม leaveeasy-spec.md
   ========================================================= */

// 📁 users — ผู้ใช้ 3 คน
const users = [
  { id: "u001", name: "สมชาย ใจดี",   email: "somchai@example.com", role: "employee" },
  { id: "u002", name: "สมหญิง รักงาน", email: "somying@example.com", role: "manager" },
  { id: "u003", name: "สมศรี ตั้งใจ",  email: "somsri@example.com",  role: "hr" }
];

// 📁 leaveTypes — ประเภทการลา 3 แบบ
const leaveTypes = [
  { id: "lt001", name: "ลาพักร้อน" },
  { id: "lt002", name: "ลาป่วย" },
  { id: "lt003", name: "ลากิจ" }
];

// 📁 leaveRequests — ใบขอลา 5 ใบ (สถานะกระจายครบทั้ง 3 ค่า)
const leaveRequests = [
  {
    id: "lr001",
    title: "ลาพักร้อนไปเที่ยวกับครอบครัว",
    reason: "วางแผนเดินทางไปต่างจังหวัดกับครอบครัว จองที่พักไว้ล่วงหน้าแล้ว",
    status: "รอพิจารณา",
    requesterId: "u001", requesterName: "สมชาย ใจดี",
    approverId: "u002", approverName: "สมหญิง รักงาน",
    leaveTypeId: "lt001", leaveTypeName: "ลาพักร้อน",
    startDate: "2026-09-07", endDate: "2026-09-09",
    createdAt: "2026-09-01 09:15"
  },
  {
    id: "lr002",
    title: "ลาป่วยไข้หวัดใหญ่",
    reason: "มีไข้สูงและไอมาก แพทย์แนะนำให้พักอยู่บ้าน 2 วัน",
    status: "อนุมัติ",
    requesterId: "u001", requesterName: "สมชาย ใจดี",
    approverId: "u002", approverName: "สมหญิง รักงาน",
    leaveTypeId: "lt002", leaveTypeName: "ลาป่วย",
    startDate: "2026-08-24", endDate: "2026-08-25",
    createdAt: "2026-08-24 08:05"
  },
  {
    id: "lr003",
    title: "ลากิจไปทำบัตรประชาชน",
    reason: "บัตรประชาชนหมดอายุ ต้องไปทำที่สำนักงานเขตในวันทำการ",
    status: "รอพิจารณา",
    requesterId: "u003", requesterName: "สมศรี ตั้งใจ",
    approverId: "", approverName: "",
    leaveTypeId: "lt003", leaveTypeName: "ลากิจ",
    startDate: "2026-09-15", endDate: "2026-09-15",
    createdAt: "2026-09-10 16:30"
  },
  {
    id: "lr004",
    title: "ลาพักร้อนช่วงวันหยุดยาว",
    reason: "อยากต่อวันหยุดยาวไปพักผ่อนกับครอบครัวอีก 3 วัน",
    status: "ไม่อนุมัติ",
    requesterId: "u003", requesterName: "สมศรี ตั้งใจ",
    approverId: "u002", approverName: "สมหญิง รักงาน",
    leaveTypeId: "lt001", leaveTypeName: "ลาพักร้อน",
    startDate: "2026-10-12", endDate: "2026-10-16",
    createdAt: "2026-09-20 11:00"
  },
  {
    id: "lr005",
    title: "ลาป่วยไปพบแพทย์ตามนัด",
    reason: "มีนัดตรวจติดตามอาการกับแพทย์ในช่วงเช้า",
    status: "รอพิจารณา",
    requesterId: "u001", requesterName: "สมชาย ใจดี",
    approverId: "u002", approverName: "สมหญิง รักงาน",
    leaveTypeId: "lt002", leaveTypeName: "ลาป่วย",
    startDate: "2026-09-22", endDate: "2026-09-22",
    createdAt: "2026-09-18 14:45"
  }
];

// 📁 approvals — ความเห็นการอนุมัติ (โฟลเดอร์ย่อยของแต่ละใบ)
// lr003 และ lr005 ยังไม่มีความเห็น จึงเป็นรายการว่าง
// lr004 (ไม่อนุมัติ) มีความเห็นเสมอ ตามกฎ "ไม่อนุมัติต้องเขียนความเห็นก่อน"
const approvals = {
  lr001: [
    { authorId: "u002", authorName: "สมหญิง รักงาน",
      message: "รับเรื่องแล้ว ขอดูตารางงานของทีมช่วงนั้นก่อนนะครับ",
      createdAt: "2026-09-01 13:40" },
    { authorId: "u003", authorName: "สมศรี ตั้งใจ",
      message: "ตรวจแล้ว วันลาพักร้อนคงเหลือครอบคลุมช่วงที่ขอ ไม่ติดขัดฝั่งฝ่ายบุคคล",
      createdAt: "2026-09-02 10:05" }
  ],
  lr002: [
    { authorId: "u002", authorName: "สมหญิง รักงาน",
      message: "อนุมัติแล้ว พักผ่อนให้เต็มที่ งานที่ค้างไว้เดี๋ยวทีมช่วยดูให้",
      createdAt: "2026-08-24 09:20" }
  ],
  lr003: [],
  lr004: [
    { authorId: "u002", authorName: "สมหญิง รักงาน",
      message: "ช่วงนั้นทีมมีงานส่งมอบพอดี ขอเลื่อนเป็นสัปดาห์ถัดไปได้ไหมครับ",
      createdAt: "2026-09-20 15:10" }
  ],
  lr005: []
};
