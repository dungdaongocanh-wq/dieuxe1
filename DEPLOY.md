# 🚀 Hướng dẫn Deploy lên Railway.app

## Yêu cầu
- Tài khoản [Railway.app](https://railway.app) (free tier có $5 credit/tháng)
- GitHub account đã kết nối Railway

## Deploy Backend

### Bước 1: Tạo project Railway
1. Vào [railway.app](https://railway.app) → **New Project**
2. Chọn **Deploy from GitHub repo** → chọn repo `dieuxe1`
3. Chọn **Add service** → **GitHub Repo** → chọn thư mục `backend`

### Bước 2: Cấu hình Backend Service
Trong Railway dashboard → Backend service → **Variables**, thêm:

| Variable | Giá trị |
|----------|---------|
| `JWT_SECRET` | (tạo chuỗi ngẫu nhiên dài, VD: `openssl rand -base64 32`) |
| `NODE_ENV` | `production` |
| `PORT` | `3001` (Railway sẽ override bằng $PORT tự động) |
| `DB_PATH` | `/data/dieuxe.db` |
| `FRONTEND_URL` | URL của frontend service (VD: `https://dieuxe-frontend.up.railway.app`) |

### Bước 3: Thêm Persistent Volume cho SQLite
1. Backend service → **Volumes** → **Add Volume**
2. Mount path: `/data`
3. Đây là nơi lưu file SQLite database (dữ liệu không bị mất khi redeploy)

### Bước 4: Deploy Frontend Service
1. Trong cùng project → **New Service** → **GitHub Repo** → thư mục `frontend`
2. Variables:
   | Variable | Giá trị |
   |----------|---------|
   | `VITE_API_URL` | URL của backend service (VD: `https://dieuxe-backend.up.railway.app`) |

### Bước 5: Lấy URL
- Backend URL: `https://xxx.up.railway.app`
- Frontend URL: `https://yyy.up.railway.app`

## Tài khoản demo mặc định

| Vai trò | Username | Password |
|---------|----------|----------|
| Admin | admin | Admin@123 |
| Kế Toán | ketoan | Ketoan@123 |
| Quản Lý Xe | quanly | Quanly@123 |
| Lái Xe | nguyenvankham | Driver@123 |

## Lưu ý quan trọng

- **SQLite + Persistent Volume**: Dữ liệu được lưu tại `/data/dieuxe.db` trên Railway volume. Không dùng disk ephemeral.
- **Free tier**: Railway cho $5 credit/tháng miễn phí. Với app nhỏ này đủ dùng ~500 giờ/tháng.
- **CORS**: Backend đã cấu hình CORS, chỉ cần update `FRONTEND_URL` env nếu cần restrict.
