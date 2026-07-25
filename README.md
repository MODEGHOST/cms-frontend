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

## รัน

```bash
cp .env.example .env
npm install
npm run dev
```
