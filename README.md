# CMS Frontend

UI ระบบ Complaint Management — Phase 1: **Reject**

## โครงสร้าง (ดูโค้ดง่าย)

```
cms-frontend/
├── public/
├── test/
└── src/
    ├── main.jsx            # จุดเริ่มต้น React
    ├── styles.css
    ├── app/                # App shell + routes
    ├── layouts/            # Layout หลัก (sidebar/header)
    ├── pages/              # หน้าเต็มๆ ตามเมนู
    ├── components/         # ชิ้นส่วนย่อย แยกตามโดเมน
    │   ├── ui/
    │   ├── dashboard/
    │   ├── forms/
    │   ├── masters/
    │   └── rejects/
    ├── services/           # เรียก API
    ├── hooks/
    ├── constants/
    └── utils/
```

กฎสั้นๆ:
- หน้าใหม่ → ใส่ `pages/`
- ชิ้นส่วนใช้ซ้ำ → ใส่ `components/<โดเมน>/`
- เรียก API → ใส่ `services/`

## Runtime

Build toolchain รองรับ **Node.js 16.20.x** (`engines`: `>=16.20.0`) เหมือน IPMS — Vite 4 + Tailwind 3

แนะนำ: build `dist/` บนเครื่อง dev (Node 18/20 ก็ได้) แล้วอัปโหลด **เนื้อใน `dist/`** ขึ้น IIS ที่ `/lfb_cms/frontend` (ต้องมี `web.config` ใน dist — Vite copy จาก `public/`)

Production build ตั้ง `base` เป็น `/lfb_cms/frontend/` และเรียก API ที่ `/lfb_cms/backend/api` (เหมือน IPMS ที่ `/lfb_ipms/...`)

## รัน

```bash
cp .env.example .env
npm install
npm run dev
```
