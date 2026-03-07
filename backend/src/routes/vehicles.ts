// Routes quản lý xe (Biển Kiểm Soát)
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { isAdminOrFleetManager } from '../middleware/roleCheck';

const router = Router();
const prisma = new PrismaClient();

// Tất cả routes đều yêu cầu xác thực
router.use(authenticate);

// GET /api/vehicles - Lấy danh sách xe
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { activeOnly } = req.query;
    const where = activeOnly === 'true' ? { isActive: true } : {};

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { licensePlate: 'asc' },
    });

    res.json(vehicles);
  } catch (error) {
    console.error('Lỗi lấy danh sách xe:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// GET /api/vehicles/:id - Lấy thông tin chi tiết xe
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!vehicle) {
      res.status(404).json({ message: 'Không tìm thấy xe' });
      return;
    }

    res.json(vehicle);
  } catch (error) {
    console.error('Lỗi lấy thông tin xe:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// POST /api/vehicles - Tạo xe mới (admin/fleet_manager)
router.post('/', isAdminOrFleetManager, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { licensePlate, vehicleType, fuelRate, pricePerKm, notes } = req.body;

    if (!licensePlate) {
      res.status(400).json({ message: 'Vui lòng nhập biển kiểm soát' });
      return;
    }

    // Kiểm tra biển số đã tồn tại chưa
    const existing = await prisma.vehicle.findUnique({ where: { licensePlate } });
    if (existing) {
      res.status(400).json({ message: 'Biển kiểm soát đã tồn tại trong hệ thống' });
      return;
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        licensePlate,
        vehicleType: vehicleType || null,
        fuelRate: fuelRate ? parseFloat(fuelRate) : 8.5,
        pricePerKm: pricePerKm ? parseFloat(pricePerKm) : 10000,
        notes: notes || null,
      },
    });

    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Lỗi tạo xe:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// PUT /api/vehicles/:id - Cập nhật thông tin xe (admin/fleet_manager)
router.put('/:id', isAdminOrFleetManager, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { licensePlate, vehicleType, fuelRate, pricePerKm, notes, isActive } = req.body;

    const existing = await prisma.vehicle.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      res.status(404).json({ message: 'Không tìm thấy xe' });
      return;
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: parseInt(id) },
      data: {
        licensePlate: licensePlate ?? existing.licensePlate,
        vehicleType: vehicleType !== undefined ? vehicleType : existing.vehicleType,
        fuelRate: fuelRate !== undefined ? parseFloat(fuelRate) : existing.fuelRate,
        pricePerKm: pricePerKm !== undefined ? parseFloat(pricePerKm) : existing.pricePerKm,
        notes: notes !== undefined ? notes : existing.notes,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
      },
    });

    res.json(vehicle);
  } catch (error) {
    console.error('Lỗi cập nhật xe:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// DELETE /api/vehicles/:id - Xóa xe (admin)
router.delete('/:id', isAdminOrFleetManager, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.vehicle.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      res.status(404).json({ message: 'Không tìm thấy xe' });
      return;
    }

    // Kiểm tra xe có lịch trình không trước khi xóa
    const scheduleCount = await prisma.schedule.count({ where: { vehicleId: parseInt(id) } });
    if (scheduleCount > 0) {
      // Thay vì xóa hẳn, đánh dấu không hoạt động
      await prisma.vehicle.update({
        where: { id: parseInt(id) },
        data: { isActive: false },
      });
      res.json({ message: 'Đã vô hiệu hóa xe (có lịch sử sử dụng)' });
      return;
    }

    await prisma.vehicle.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Đã xóa xe thành công' });
  } catch (error) {
    console.error('Lỗi xóa xe:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

export default router;
