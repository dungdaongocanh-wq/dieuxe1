// Ứng dụng Express chính - cấu hình server và routes
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Tắt ETag để tránh phản hồi 304 Not Modified
app.set('etag', false);

// Tắt cache cho tất cả API responses
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Rate limiter cho route đăng nhập (nghiêm ngặt hơn)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 20,
  message: { message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter chung cho API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 200,
  message: { message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware xử lý JSON và CORS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Áp dụng rate limiter cho tất cả API
app.use('/api/', apiLimiter);

// Route kiểm tra server (health check cho Railway)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Đăng ký các routes API
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/fuel-logs', require('./routes/fuelLogs'));

// Xử lý route không tồn tại
app.use((req, res) => {
  res.status(404).json({ message: 'Không tìm thấy endpoint' });
});

// Xử lý lỗi toàn cục
app.use((err, req, res, next) => {
  console.error('Lỗi không xử lý được:', err);
  res.status(500).json({ message: 'Lỗi server nội bộ' });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📊 Môi trường: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
