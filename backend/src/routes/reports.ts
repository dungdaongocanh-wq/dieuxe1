// Routes báo cáo theo tháng
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { isAdminOrAccountant } from '../middleware/roleCheck';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// GET /api/reports/monthly - Báo cáo tổng hợp theo tháng
router.get('/monthly', isAdminOrAccountant, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      res.status(400).json({ message: 'Vui lòng cung cấp tháng và năm' });
      return;
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);

    const dateFrom = new Date(yearNum, monthNum - 1, 1);
    const dateTo = new Date(yearNum, monthNum, 1);

    // Lấy tất cả lịch trình trong tháng
    const schedules = await prisma.schedule.findMany({
      where: {
        tripDate: { gte: dateFrom, lt: dateTo },
        status: 'approved',
      },
      include: {
        driver: { select: { id: true, fullName: true, username: true } },
        vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
      },
      orderBy: { tripDate: 'asc' },
    });

    // Tổng hợp theo xe
    const byVehicle: Record<string, {
      licensePlate: string;
      vehicleType: string | null;
      totalTrips: number;
      totalKm: number;
      totalAmount: number;
      totalFuel: number;
    }> = {};

    // Tổng hợp theo lái xe
    const byDriver: Record<string, {
      fullName: string;
      username: string;
      totalTrips: number;
      totalKm: number;
      totalAmount: number;
      totalFuel: number;
    }> = {};

    // Tổng tất cả
    let totalTrips = 0;
    let totalKm = 0;
    let totalAmount = 0;
    let totalFuel = 0;

    for (const s of schedules) {
      // Theo xe
      const vKey = s.vehicle.licensePlate;
      if (!byVehicle[vKey]) {
        byVehicle[vKey] = {
          licensePlate: s.vehicle.licensePlate,
          vehicleType: s.vehicle.vehicleType,
          totalTrips: 0,
          totalKm: 0,
          totalAmount: 0,
          totalFuel: 0,
        };
      }
      byVehicle[vKey].totalTrips += 1;
      byVehicle[vKey].totalKm += s.kmTotal;
      byVehicle[vKey].totalAmount += s.amountBeforeTax;
      byVehicle[vKey].totalFuel += s.fuelConsumed;

      // Theo lái xe
      const dKey = s.driver.username;
      if (!byDriver[dKey]) {
        byDriver[dKey] = {
          fullName: s.driver.fullName,
          username: s.driver.username,
          totalTrips: 0,
          totalKm: 0,
          totalAmount: 0,
          totalFuel: 0,
        };
      }
      byDriver[dKey].totalTrips += 1;
      byDriver[dKey].totalKm += s.kmTotal;
      byDriver[dKey].totalAmount += s.amountBeforeTax;
      byDriver[dKey].totalFuel += s.fuelConsumed;

      // Tổng
      totalTrips += 1;
      totalKm += s.kmTotal;
      totalAmount += s.amountBeforeTax;
      totalFuel += s.fuelConsumed;
    }

    res.json({
      month: monthNum,
      year: yearNum,
      summary: { totalTrips, totalKm, totalAmount, totalFuel },
      byVehicle: Object.values(byVehicle),
      byDriver: Object.values(byDriver),
      schedules,
    });
  } catch (error) {
    console.error('Lỗi báo cáo:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

// GET /api/reports/dashboard - Thống kê tổng quan
router.get('/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Thống kê hôm nay
    const todaySchedules = await prisma.schedule.findMany({
      where: {
        tripDate: { gte: startOfToday, lt: endOfToday },
      },
    });

    const todayTrips = todaySchedules.length;
    const todayKm = todaySchedules.reduce((sum, s) => sum + s.kmTotal, 0);
    const todayCost = todaySchedules.reduce((sum, s) => sum + s.amountBeforeTax, 0);

    // Thống kê tháng hiện tại
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const monthSchedules = await prisma.schedule.findMany({
      where: {
        tripDate: { gte: startOfMonth, lt: endOfMonth },
      },
      include: {
        driver: { select: { id: true, fullName: true } },
      },
    });

    // Dữ liệu KM theo ngày trong tháng (cho biểu đồ)
    const kmByDay: Record<string, number> = {};
    for (const s of monthSchedules) {
      const day = s.tripDate.toISOString().split('T')[0];
      kmByDay[day] = (kmByDay[day] || 0) + s.kmTotal;
    }

    // Top 5 lái xe nhiều km nhất trong tháng
    const driverKm: Record<string, { fullName: string; totalKm: number }> = {};
    for (const s of monthSchedules) {
      const dKey = String(s.driverId);
      if (!driverKm[dKey]) {
        driverKm[dKey] = { fullName: s.driver.fullName, totalKm: 0 };
      }
      driverKm[dKey].totalKm += s.kmTotal;
    }

    const topDrivers = Object.values(driverKm)
      .sort((a, b) => b.totalKm - a.totalKm)
      .slice(0, 5);

    res.json({
      today: {
        trips: todayTrips,
        km: todayKm,
        cost: todayCost,
      },
      month: {
        trips: monthSchedules.length,
        km: monthSchedules.reduce((sum, s) => sum + s.kmTotal, 0),
        cost: monthSchedules.reduce((sum, s) => sum + s.amountBeforeTax, 0),
        fuel: monthSchedules.reduce((sum, s) => sum + s.fuelConsumed, 0),
      },
      kmByDay: Object.entries(kmByDay)
        .map(([date, km]) => ({ date, km }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topDrivers,
    });
  } catch (error) {
    console.error('Lỗi dashboard:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

export default router;
