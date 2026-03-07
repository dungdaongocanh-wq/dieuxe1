# Bảng Theo Dõi Lịch Trình Hàng Ngày Của Lái Xe

Hệ thống quản lý và theo dõi lịch trình di chuyển hàng ngày của lái xe, bao gồm phân quyền theo vai trò người dùng.

## Tính năng

- 🔐 Xác thực với JWT, phân quyền theo 4 vai trò: Admin, Kế Toán, Quản Lý Xe, Lái Xe
- 📋 Quản lý lịch trình chuyến đi (thêm, sửa, xóa, duyệt/từ chối)
- 🚗 Quản lý phương tiện (biển số, loại xe)
- 👥 Quản lý người dùng (Admin)
- 📊 Dashboard thống kê tổng quan
- 🔍 Tìm kiếm và lọc theo ngày, lái xe, phương tiện, trạng thái

## Công nghệ

**Backend:** Node.js, Express, better-sqlite3, JWT, bcryptjs  
**Frontend:** React 18, Vite, Tailwind CSS, React Router DOM

## Cài đặt và chạy

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Tài khoản demo

| Vai trò | Tên đăng nhập | Mật khẩu |
|---------|--------------|----------|
| Admin | admin | Admin@123 |
| Kế Toán | ketoan1 | Ketoan@123 |
| Quản Lý Xe | quanly1 | Quanly@123 |
| Lái Xe 1 | laixe1 | Laixe@123 |
| Lái Xe 2 | laixe2 | Laixe@123 |