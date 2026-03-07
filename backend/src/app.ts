// App chính - CÔNG TY TNHH DNA EXPRESS VIỆT NAM
// Bảng Theo Dõi Tình Hình Sử Dụng Xe

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Load biến môi trường
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import scheduleRoutes from './routes/schedules';
import vehicleRoutes from './routes/vehicles';
import userRoutes from './routes/users';
import reportRoutes from './routes/reports';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting: giới hạn request để chống brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 20,                   // Tối đa 20 lần đăng nhập/15 phút
  message: { message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 500,                  // Tối đa 500 request/15 phút cho API thông thường
  message: { message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/schedules', apiLimiter, scheduleRoutes);
app.use('/api/vehicles', apiLimiter, vehicleRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/reports', apiLimiter, reportRoutes);

// Health check
app.get('/api/health', (_, res) => {
  res.json({ 
    status: 'OK', 
    message: 'DNA Express Vehicle Tracking API',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_, res) => {
  res.status(404).json({ message: 'Endpoint không tồn tại' });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`=== DNA Express Vehicle Tracking API ===`);
  console.log(`Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`Môi trường: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
