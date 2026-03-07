// Seed data mẫu cho hệ thống Bảng Theo Dõi Tình Hình Sử Dụng Xe
// CÔNG TY TNHH DNA EXPRESS VIỆT NAM

import { PrismaClient, Role, Status } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu seed dữ liệu mẫu...');

  // Xóa dữ liệu cũ (theo thứ tự để tránh lỗi foreign key)
  await prisma.schedule.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();

  const saltRounds = 10;

  // Tạo 5 tài khoản mẫu
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: await bcrypt.hash('Admin@123', saltRounds),
      fullName: 'Quản Lý Cấp Cao',
      role: Role.admin,
    },
  });

  const ketoan = await prisma.user.create({
    data: {
      username: 'ketoan',
      password: await bcrypt.hash('Ketoan@123', saltRounds),
      fullName: 'Kế Toán Viên',
      role: Role.accountant,
    },
  });

  const quanly = await prisma.user.create({
    data: {
      username: 'quanly',
      password: await bcrypt.hash('Quanly@123', saltRounds),
      fullName: 'Quản Lý Lái Xe',
      role: Role.fleet_manager,
    },
  });

  const driver1 = await prisma.user.create({
    data: {
      username: 'nguyenvankham',
      password: await bcrypt.hash('Driver@123', saltRounds),
      fullName: 'Nguyễn Văn Khám',
      role: Role.driver,
    },
  });

  const driver2 = await prisma.user.create({
    data: {
      username: 'phamvandiep',
      password: await bcrypt.hash('Driver@123', saltRounds),
      fullName: 'Phạm Văn Điệp',
      role: Role.driver,
    },
  });

  console.log('Đã tạo 5 tài khoản mẫu');

  // Tạo 2 xe mẫu
  const vehicle1 = await prisma.vehicle.create({
    data: {
      licensePlate: '99H07049',
      vehicleType: 'Xe tải',
      fuelRate: 8.5,   // 8.5 lít/100km
      pricePerKm: 10000, // 10,000 VND/km
      notes: 'Xe tải nhỏ',
    },
  });

  const vehicle2 = await prisma.vehicle.create({
    data: {
      licensePlate: '99H07050',
      vehicleType: 'Xe tải',
      fuelRate: 9.0,   // 9.0 lít/100km
      pricePerKm: 10000, // 10,000 VND/km
      notes: 'Xe tải lớn',
    },
  });

  console.log('Đã tạo 2 xe mẫu');

  // Tạo dữ liệu lịch trình mẫu cho tháng hiện tại
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const scheduleData = [
    {
      driverId: driver1.id,
      vehicleId: vehicle1.id,
      tripDate: new Date(year, month, 2),
      departurePoint: 'ILS - TECH',
      destinationPoint: 'HANSOL, SR',
      kmStart: 1000,
      kmEnd: 1085,
    },
    {
      driverId: driver1.id,
      vehicleId: vehicle1.id,
      tripDate: new Date(year, month, 3),
      departurePoint: 'ILS - TECH',
      destinationPoint: 'HDB, HANSOL',
      kmStart: 1085,
      kmEnd: 1162,
    },
    {
      driverId: driver2.id,
      vehicleId: vehicle2.id,
      tripDate: new Date(year, month, 2),
      departurePoint: 'ILS - TECH',
      destinationPoint: 'INTOPS',
      kmStart: 500,
      kmEnd: 578,
    },
    {
      driverId: driver2.id,
      vehicleId: vehicle2.id,
      tripDate: new Date(year, month, 4),
      departurePoint: 'ILS - TECH',
      destinationPoint: 'HANSOL, SR',
      kmStart: 578,
      kmEnd: 650,
    },
  ];

  for (const data of scheduleData) {
    const vehicle = data.vehicleId === vehicle1.id ? vehicle1 : vehicle2;
    const kmTotal = data.kmEnd - data.kmStart;
    const amountBeforeTax = kmTotal * vehicle.pricePerKm;
    const fuelConsumed = (kmTotal * vehicle.fuelRate) / 100;

    await prisma.schedule.create({
      data: {
        ...data,
        kmTotal,
        amountBeforeTax,
        fuelConsumed,
        status: Status.approved,
      },
    });
  }

  console.log('Đã tạo dữ liệu lịch trình mẫu');
  console.log('\n=== THÔNG TIN TÀI KHOẢN MẪU ===');
  console.log('admin / Admin@123 - Quản lý cấp cao');
  console.log('ketoan / Ketoan@123 - Kế toán');
  console.log('quanly / Quanly@123 - Quản lý lái xe');
  console.log('nguyenvankham / Driver@123 - Lái xe');
  console.log('phamvandiep / Driver@123 - Lái xe');
}

main()
  .catch((e) => {
    console.error('Lỗi seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
