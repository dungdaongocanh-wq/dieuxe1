// Routes xác thực - đăng nhập/đăng xuất
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// POST /api/auth/login - Đăng nhập
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
      return;
    }

    // Tìm người dùng theo username
    const user = await prisma.user.findUnique({ where: { username } });
    
    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
      return;
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET chưa được cấu hình');
    }

    // Tạo JWT token (hết hạn sau 8 giờ)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// POST /api/auth/logout - Đăng xuất (client-side: xóa token)
router.post('/logout', authenticate, (req: AuthRequest, res: Response) => {
  res.json({ message: 'Đăng xuất thành công' });
});

// GET /api/auth/me - Lấy thông tin người dùng hiện tại
router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
