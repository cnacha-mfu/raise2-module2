# 📚 คลังสื่อการสอน — ADT-RAISE Batch 2 · Module 2: MVP-Ready

**Full-Stack ด้วย Claude AI · สัปดาห์ที่ 6–9 · 29 ส.ค. – 22 ก.ย. 2569 · Online สด**
ผู้เรียน ~40 คน ไม่มีพื้นฐาน IT · 🚫 **ไม่มีงานกลุ่ม — ทุกคนทำระบบของตัวเอง** · ผู้สอน 1 + TA 2

🌐 เวอร์ชันเว็บ: https://cnacha-mfu.github.io/raise2-module2/

---

## 🗺️ มีอะไรอยู่ตรงไหน

```
Raise2/
├── plan.md                 แผนการสอนฉบับเต็ม — แหล่งความจริง (รองจากคู่มือผู้เรียน)
├── CLAUDE.md               คู่มือการผลิตสื่อ (สำหรับ AI ที่ช่วยทำสื่อต่อ)
├── index.html              หน้า TOC ของเว็บ GitHub Pages
│
├── materials/
│   ├── shared/
│   │   ├── glossary.md     แผ่นศัพท์ภาษาคน — แจกผู้เรียนคาบแรก
│   │   ├── specs/          Spec ของ FixIt (สาธิต) และ LeaveEasy (ใบงาน)
│   │   ├── recovery/       ชุดกู้สถานะรายสัปดาห์ (เป็นชุด prompt ไม่ใช่โค้ด)
│   │   ├── templates/      .gitignore · CLAUDE.md · ตัวอย่าง Rules · ตั้งค่า Playwright MCP
│   │   └── supplements/    สไลด์เสริม HTML มีแอนิเมชัน (llm-basics)
│   └── week6/ … week9/     สัปดาห์ละ 4 ชิ้น (ดูตาราง)
│
└── scripts/
    ├── build_slides.py     แปลง wN-slides.md → .pptx
    └── check_slides.py     ตรวจสไลด์ล้นจอ/ฟอนต์/การจัดวาง
```

## 📦 สื่อ 4 ชิ้นต่อสัปดาห์

| ไฟล์ | ใช้เมื่อไร | ตัวอย่างที่ใช้ |
|---|---|---|
| `wN-slides.md` → `.pptx` | Lecture เสาร์ 09:00–12:00 | 🎬 FixIt |
| `wN-demo-fixit.md` | ผู้สอนเปิดคู่กันระหว่างสาธิต (ไม่ขึ้นเว็บ) | 🎬 FixIt |
| `wN-lab-leaveeasy.md` | Workshop เสาร์ 13:00–16:00 — **ทุกคนทำระบบเดียวกัน** | 🔧 LeaveEasy |
| `wN-homework.md` | ทำระหว่างสัปดาห์ ส่ง Google Classroom | 👤 หัวข้อของตัวเอง |

## 🧭 โครง 4 สัปดาห์

| สัปดาห์ | ความคิดใหม่ | เนื้อหาหลัก |
|:---:|---|---|
| **6** 🗄️ | ระบบเริ่มมีความจำ | Setup · วงจร 4 จังหวะ · NoSQL · **สร้าง Firestore + อ่านจากฐานจริง** |
| **7** ⭐ | ระบบรู้จักผู้ใช้และออกสู่โลก | CLAUDE.md · **CRUD ครบ** · **ล็อกอิน + กฎขั้นต่ำ** · Git ทีม · **Deploy** |
| **8** 🤖 | ระบบมียามเฝ้าและมีผู้ช่วย | **Rules รายห้อง** · **Agentic AI ผ่าน OpenRouter** · Reviewer |
| **9** 🧪 | ระบบพิสูจน์ตัวเองได้ | Tester + Playwright MCP · คลิปสาธิต + **Consult รายคน** (TPQI 7001–7005) |

## 🔨 วิธี build สไลด์

```
python scripts/build_slides.py "materials/week6/w6-slides.md"
python scripts/check_slides.py
python scripts/build_html_slides.py   # สร้างเวอร์ชันเว็บ (wN-slides.html) ทุกสัปดาห์
```

ตรวจก่อนใช้จริงทุกครั้ง: เช็กลิสต์ใน `CLAUDE.md` ข้อ 9
