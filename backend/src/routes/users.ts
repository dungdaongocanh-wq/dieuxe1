// Routes quản lý tài khoản người dùng
import { Router, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { authenticate, AuthRequest } from '../middleware/auth';
import { isAdmin, isAdminOrFleetManager } from '../middleware/roleCheck';

const router = Router();
const prisma = new PrismaClient();

// Tất cả routes đều yêu cầu xác thực
router.use(authenticate);

// GET /api/users - Lấy danh sách người dùng
// Admin thấy tất cả; fleet_manager chỉ thấy driver
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const where: Record<string, unknown> = {};

    // Fleet manager chỉ thấy danh sách lái xe
    if (user.role === 'fleet_manager') {
      where.role = 'driver';
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Lỗi lấy danh sách người dùng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// POST /api/users - Tạo tài khoản mới (admin)
router.post('/', isAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, password, fullName, role } = req.body;

    if (!username || !password || !fullName || !role) {
      res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
      return;
    }

    // Kiểm tra role hợp lệ
    if (!Object.values(Role).includes(role)) {
      res.status(400).json({ message: 'Vai trò không hợp lệ' });
      return;
    }

    // Kiểm tra username đã tồn tại chưa
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
      return;
    }

    // Kiểm tra độ mạnh mật khẩu
    if (password.length < 6) {
      res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        fullName,
        role,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Lỗi tạo tài khoản:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// PUT /api/users/:id - Cập nhật tài khoản (admin)
router.put('/:id', isAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fullName, password, role, isActive } = req.body;

    const existing = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      res.status(404).json({ message: 'Không tìm thấy tài khoản' });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (fullName) updateData.fullName = fullName;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (password) {
      if (password.length < 6) {
        res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
        return;
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Lỗi cập nhật tài khoản:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// DELETE /api/users/:id - Xóa tài khoản (admin)
router.delete('/:id', isAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user!;

    // Không cho xóa chính mình
    if (parseInt(id) === currentUser.id) {
      res.status(400).json({ message: 'Không thể xóa tài khoản đang đăng nhập' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      res.status(404).json({ message: 'Không tìm thấy tài khoản' });
      return;
    }

    // Kiểm tra người dùng có lịch trình không
    const scheduleCount = await prisma.schedule.count({ where: { driverId: parseInt(id) } });
    if (scheduleCount > 0) {
      // Thay vì xóa hẳn, vô hiệu hóa tài khoản
      await prisma.user.update({
        where: { id: parseInt(id) },
        data: { isActive: false },
      });
      res.json({ message: 'Đã vô hiệu hóa tài khoản (có lịch sử hoạt động)' });
      return;
    }

    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Đã xóa tài khoản thành công' });
  } catch (error) {
    console.error('Lỗi xóa tài khoản:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

export default router;
