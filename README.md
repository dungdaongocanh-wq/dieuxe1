# Bảng Theo Dõi Tình Hình Sử Dụng Xe

**CÔNG TY TNHH DNA EXPRESS VIỆT NAM**  
MST: 0107514537 | Cụm Công Nghiệp Hạp Lĩnh, Phường Hạp Lĩnh, Tỉnh Bắc Ninh, Việt Nam

---

## Giới Thiệu

Ứng dụng web quản lý và theo dõi tình hình sử dụng xe của công ty. Hỗ trợ 4 cấp độ người dùng:

| Cấp độ | Vai trò | Quyền hạn |
|--------|---------|-----------|
| 1 | **Quản lý cấp cao** (admin) | Xem tất cả, xuất báo cáo, quản lý tài khoản |
| 2 | **Kế toán** (accountant) | Xem lịch trình, xuất báo cáo tài chính |
| 3 | **Quản lý lái xe** (fleet_manager) | Quản lý lái xe, quản lý xe, duyệt lịch trình |
| 4 | **Lái xe** (driver) | Nhập lịch trình hàng ngày của mình |

---

## Tech Stack

- **Frontend**: React + TypeScript + Ant Design + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: MySQL + Prisma ORM
- **Auth**: JWT + bcrypt
- **Docker**: docker-compose.postgresql.yml cho PostgreSQL (tùy chọn)

---

## Cấu Trúc Thư Mục

```
dieuxe1/
├── README.md
├── docker-compose.postgresql.yml  ← PostgreSQL (tùy chọn, không cần khi dùng XAMPP)
├── frontend/                   ← React + TypeScript + Ant Design
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx       ← Trang đăng nhập
│   │   │   ├── Dashboard.tsx   ← Tổng quan
│   │   │   ├── SchedulePage.tsx← Bảng lịch trình
│   │   │   ├── VehiclePage.tsx ← Quản lý xe
│   │   │   ├── UserPage.tsx    ← Quản lý tài khoản
│   │   │   └── ReportPage.tsx  ← Báo cáo
│   │   ├── components/
│   │   │   └── MainLayout.tsx  ← Layout chính với sidebar
│   │   ├── context/
│   │   │   └── AuthContext.tsx ← Xác thực JWT
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── backend/
    ├── src/
    │   ├── routes/
    │   │   ├── auth.ts         ← API đăng nhập/đăng xuất
    │   │   ├── schedules.ts    ← CRUD lịch trình
    │   │   ├── vehicles.ts     ← CRUD xe
    │   │   ├── users.ts        ← CRUD tài khoản
    │   │   └── reports.ts      ← Báo cáo
    │   ├── middleware/
    │   │   ├── auth.ts         ← JWT middleware
    │   │   └── roleCheck.ts    ← Phân quyền
    │   ├── prisma/
    │   │   ├── schema.prisma   ← Database schema
    │   │   └── seed.ts         ← Dữ liệu mẫu
    │   └── app.ts
    ├── .env.example
    └── package.json
```

---

## Hướng Dẫn Cài Đặt

## 🚀 Cách chạy với XAMPP (MySQL) — Khuyến nghị cho người mới

### Yêu cầu
- [Node.js v18+](https://nodejs.org)
- [XAMPP](https://www.apachefriends.org) (đã cài sẵn MySQL)
- [Git](https://git-scm.com)

### Bước 1: Tạo database trong phpMyAdmin
1. Mở XAMPP → Start **MySQL**
2. Vào http://localhost/phpmyadmin
3. Tạo database mới: `dna_express_db` (Collation: `utf8mb4_unicode_ci`)

### Bước 2: Clone và cài đặt
```bash
git clone https://github.com/dungdaongocanh-wq/dieuxe1.git
cd dieuxe1
```

### Bước 3: Cài đặt Backend
```bash
cd backend
npm install
cp .env.example .env
# Mở file .env và kiểm tra DATABASE_URL
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```
Backend chạy tại: http://localhost:3001

### Bước 4: Cài đặt Frontend (Terminal mới)
```bash
cd frontend
npm install
npm run dev
```
Frontend chạy tại: http://localhost:5173

### Bước 5: Đăng nhập
Truy cập http://localhost:5173

| Tài khoản | Mật khẩu | Vai trò |
|-----------|----------|---------|
| admin | Admin@123 | Quản lý cấp cao |
| ketoan | Ketoan@123 | Kế toán |
| quanly | Quanly@123 | Quản lý lái xe |
| nguyenvankham | Driver@123 | Lái xe |
| phamvandiep | Driver@123 | Lái xe |

---

## Cách chạy với Docker (PostgreSQL) — Tùy chọn nâng cao

### Yêu Cầu Hệ Thống

- Node.js >= 18.x
- Docker & Docker Compose
- npm hoặc yarn

### Bước 1: Clone và cài đặt

```bash
git clone <repo-url>
cd dieuxe1
```

### Bước 2: Khởi động PostgreSQL

```bash
docker-compose -f docker-compose.postgresql.yml up -d
```

PostgreSQL sẽ chạy tại: `localhost:5432`

### Bước 3: Cấu hình Backend

```bash
cd backend
cp .env.example .env
# Chỉnh sửa .env: đặt DATABASE_URL trỏ đến PostgreSQL
# Ví dụ: DATABASE_URL="postgresql://dnaexpress:dnaexpress123@localhost:5432/dna_express_db"
npm install
```

### Bước 4: Tạo database và seed dữ liệu

```bash
# Trong thư mục backend
npx prisma migrate dev --name init --schema=src/prisma/schema.prisma
npx prisma generate --schema=src/prisma/schema.prisma
npm run prisma:seed
```

### Bước 5: Khởi động Backend

```bash
# Trong thư mục backend
npm run dev
# Server chạy tại: http://localhost:3001
```

### Bước 6: Cài đặt và khởi động Frontend

```bash
cd ../frontend
npm install
npm run dev
# Frontend chạy tại: http://localhost:5173
```

### Bước 7: Truy cập ứng dụng

Mở trình duyệt và truy cập: **http://localhost:5173**

---

## Tài Khoản Mẫu

| Tên đăng nhập | Mật khẩu | Vai trò |
|---------------|----------|---------|
| `admin` | `Admin@123` | Quản lý cấp cao |
| `ketoan` | `Ketoan@123` | Kế toán |
| `quanly` | `Quanly@123` | Quản lý lái xe |
| `nguyenvankham` | `Driver@123` | Lái xe |
| `phamvandiep` | `Driver@123` | Lái xe |

---

## Xe Mẫu

| Biển số | Loại xe | Định mức xăng | Đơn giá |
|---------|---------|---------------|---------|
| 99H07049 | Xe tải | 8.5 lít/100km | 10,000 VND/km |
| 99H07050 | Xe tải | 9.0 lít/100km | 10,000 VND/km |

---

## API Endpoints

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/schedules          ?month=&year=&vehicleId=&driverId=
POST   /api/schedules
PUT    /api/schedules/:id
DELETE /api/schedules/:id
PATCH  /api/schedules/:id/status

GET    /api/vehicles
POST   /api/vehicles
PUT    /api/vehicles/:id
DELETE /api/vehicles/:id

GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id

GET    /api/reports/monthly    ?month=&year=
GET    /api/reports/dashboard
```

---

## Tính Năng Chính

### Bảng Lịch Trình
- Tiêu đề: "BẢNG THEO DÕI TÌNH HÌNH SỬ DỤNG XE (Biển số xe {BKS})"
- Lọc theo: Tháng/Năm, Biển số xe, Lái xe
- Tính toán tự động: Tổng KM, Thành tiền, Xăng tiêu thụ
- Workflow duyệt: pending → approved/rejected
- Xuất Excel

### Form Nhập Liệu
- Tự động điền tên lái xe từ JWT
- Ngày tự động (có thể chỉnh)
- Tính toán real-time khi nhập KM
- Validation: kmEnd > kmStart, không cho ngày tương lai

### Dashboard
- Thống kê hôm nay: số chuyến, tổng KM, chi phí
- Thống kê tháng: số chuyến, tổng KM, chi phí, xăng
- Top lái xe nhiều km nhất
- KM theo ngày trong tháng

### Báo Cáo
- Tổng hợp theo xe và theo lái xe
- Xuất Excel (3 sheet: Chi tiết, Theo xe, Theo lái xe)

---

## Cấu Hình Biến Môi Trường

### Backend (.env)

```env
DATABASE_URL="mysql://root:@localhost:3306/dna_express_db"
JWT_SECRET="dna_express_secret_key_change_in_production"
PORT=3001
NODE_ENV=development
```

---

## Ghi Chú Phát Triển

### Reset Database

```bash
cd backend
npx prisma migrate reset --schema=src/prisma/schema.prisma
```

### Xem Database (Prisma Studio)

```bash
cd backend
npm run prisma:studio
```

### Build Production

```bash
# Backend
cd backend && npm run build

# Frontend
cd frontend && npm run build
```