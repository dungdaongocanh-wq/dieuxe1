// Routes quản lý lịch trình chuyến xe
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { canManageSchedule } from '../middleware/roleCheck';

const router = Router();
const prisma = new PrismaClient();

// Tất cả routes đều yêu cầu xác thực
router.use(authenticate);

// GET /api/schedules - Lấy danh sách lịch trình
// Driver chỉ thấy lịch trình của mình; admin/fleet_manager/accountant thấy tất cả
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year, vehicleId, driverId } = req.query;
    const user = req.user!;

    // Xây dựng điều kiện lọc
    const where: Record<string, unknown> = {};

    // Driver chỉ xem lịch trình của mình
    if (user.role === 'driver') {
      where.driverId = user.id;
    } else if (driverId) {
      where.driverId = parseInt(driverId as string);
    }

    // Lọc theo xe
    if (vehicleId) {
      where.vehicleId = parseInt(vehicleId as string);
    }

    // Lọc theo tháng/năm
    if (month && year) {
      const monthNum = parseInt(month as string);
      const yearNum = parseInt(year as string);
      where.tripDate = {
        gte: new Date(yearNum, monthNum - 1, 1),
        lt: new Date(yearNum, monthNum, 1),
      };
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        driver: { select: { id: true, fullName: true, username: true } },
        vehicle: { select: { id: true, licensePlate: true, vehicleType: true, fuelRate: true, pricePerKm: true } },
      },
      orderBy: [{ tripDate: 'asc' }, { createdAt: 'asc' }],
    });

    res.json(schedules);
  } catch (error) {
    console.error('Lỗi lấy danh sách lịch trình:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// POST /api/schedules - Tạo lịch trình mới
router.post('/', canManageSchedule, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const {
      vehicleId,
      tripDate,
      departurePoint,
      destinationPoint,
      kmStart,
      kmEnd,
      notes,
      driverId: requestedDriverId,
    } = req.body;

    // Xác định driver: lái xe chỉ nhập cho chính mình; admin/fleet_manager có thể chỉ định
    const driverId = (user.role === 'driver') ? user.id : (requestedDriverId || user.id);

    // Validation
    if (!vehicleId || !tripDate || !departurePoint || !destinationPoint || kmStart === undefined || kmEnd === undefined) {
      res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
      return;
    }

    if (parseFloat(kmEnd) <= parseFloat(kmStart)) {
      res.status(400).json({ message: 'Số KM kết thúc phải lớn hơn số KM bắt đầu' });
      return;
    }

    const tripDateObj = new Date(tripDate);
    if (tripDateObj > new Date()) {
      res.status(400).json({ message: 'Ngày không được là ngày trong tương lai' });
      return;
    }

    // Lấy thông tin xe để tính toán
    const vehicle = await prisma.vehicle.findUnique({ where: { id: parseInt(vehicleId) } });
    if (!vehicle || !vehicle.isActive) {
      res.status(404).json({ message: 'Xe không tồn tại hoặc không hoạt động' });
      return;
    }

    const kmStartNum = parseFloat(kmStart);
    const kmEndNum = parseFloat(kmEnd);
    const kmTotal = kmEndNum - kmStartNum;
    const amountBeforeTax = kmTotal * vehicle.pricePerKm;
    const fuelConsumed = (kmTotal * vehicle.fuelRate) / 100;

    const schedule = await prisma.schedule.create({
      data: {
        driverId: parseInt(driverId),
        vehicleId: parseInt(vehicleId),
        tripDate: tripDateObj,
        departurePoint,
        destinationPoint,
        kmStart: kmStartNum,
        kmEnd: kmEndNum,
        kmTotal,
        amountBeforeTax,
        fuelConsumed,
        notes: notes || null,
      },
      include: {
        driver: { select: { id: true, fullName: true, username: true } },
        vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
      },
    });

    res.status(201).json(schedule);
  } catch (error) {
    console.error('Lỗi tạo lịch trình:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// PUT /api/schedules/:id - Cập nhật lịch trình
router.put('/:id', canManageSchedule, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const existing = await prisma.schedule.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      res.status(404).json({ message: 'Không tìm thấy lịch trình' });
      return;
    }

    // Driver chỉ được sửa lịch trình của mình và khi còn ở trạng thái pending
    if (user.role === 'driver') {
      if (existing.driverId !== user.id) {
        res.status(403).json({ message: 'Bạn không có quyền sửa lịch trình này' });
        return;
      }
      if (existing.status !== 'pending') {
        res.status(403).json({ message: 'Không thể sửa lịch trình đã được duyệt hoặc từ chối' });
        return;
      }
    }

    const {
      vehicleId,
      tripDate,
      departurePoint,
      destinationPoint,
      kmStart,
      kmEnd,
      notes,
      driverId,
    } = req.body;

    // Validation
    if (parseFloat(kmEnd) <= parseFloat(kmStart)) {
      res.status(400).json({ message: 'Số KM kết thúc phải lớn hơn số KM bắt đầu' });
      return;
    }

    // Lấy thông tin xe
    const vehicleIdNum = parseInt(vehicleId || existing.vehicleId);
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleIdNum } });
    if (!vehicle) {
      res.status(404).json({ message: 'Xe không tồn tại' });
      return;
    }

    const kmStartNum = parseFloat(kmStart ?? existing.kmStart);
    const kmEndNum = parseFloat(kmEnd ?? existing.kmEnd);
    const kmTotal = kmEndNum - kmStartNum;
    const amountBeforeTax = kmTotal * vehicle.pricePerKm;
    const fuelConsumed = (kmTotal * vehicle.fuelRate) / 100;

    const updated = await prisma.schedule.update({
      where: { id: parseInt(id) },
      data: {
        vehicleId: vehicleIdNum,
        tripDate: tripDate ? new Date(tripDate) : existing.tripDate,
        departurePoint: departurePoint ?? existing.departurePoint,
        destinationPoint: destinationPoint ?? existing.destinationPoint,
        kmStart: kmStartNum,
        kmEnd: kmEndNum,
        kmTotal,
        amountBeforeTax,
        fuelConsumed,
        notes: notes !== undefined ? notes : existing.notes,
        driverId: driverId ? parseInt(driverId) : existing.driverId,
      },
      include: {
        driver: { select: { id: true, fullName: true, username: true } },
        vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Lỗi cập nhật lịch trình:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// DELETE /api/schedules/:id - Xóa lịch trình
router.delete('/:id', canManageSchedule, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const existing = await prisma.schedule.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      res.status(404).json({ message: 'Không tìm thấy lịch trình' });
      return;
    }

    // Driver chỉ xóa được của mình và khi pending
    if (user.role === 'driver') {
      if (existing.driverId !== user.id) {
        res.status(403).json({ message: 'Bạn không có quyền xóa lịch trình này' });
        return;
      }
      if (existing.status !== 'pending') {
        res.status(403).json({ message: 'Không thể xóa lịch trình đã được duyệt' });
        return;
      }
    }

    await prisma.schedule.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Đã xóa lịch trình thành công' });
  } catch (error) {
    console.error('Lỗi xóa lịch trình:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// PATCH /api/schedules/:id/status - Cập nhật trạng thái (admin/fleet_manager)
router.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user!;

    if (!['admin', 'fleet_manager'].includes(user.role)) {
      res.status(403).json({ message: 'Không có quyền duyệt lịch trình' });
      return;
    }

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      res.status(400).json({ message: 'Trạng thái không hợp lệ' });
      return;
    }

    const updated = await prisma.schedule.update({
      where: { id: parseInt(id) },
      data: { status },
      include: {
        driver: { select: { id: true, fullName: true, username: true } },
        vehicle: { select: { id: true, licensePlate: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

export default router;
