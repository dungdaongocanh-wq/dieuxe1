// Khởi tạo và quản lý kết nối cơ sở dữ liệu SQLite
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Đường dẫn đến file cơ sở dữ liệu
const DB_PATH = path.join(__dirname, '../../data/dieuxe.db');

// Tạo thư mục data nếu chưa tồn tại
const fs = require('fs');
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Khởi tạo kết nối database
const db = new Database(DB_PATH);

// Bật WAL mode để cải thiện hiệu suất
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Tạo các bảng nếu chưa tồn tại
function initializeDatabase() {
  // Bảng người dùng
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'accountant', 'fleet_manager', 'driver')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bảng phương tiện
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_plate TEXT UNIQUE NOT NULL,
      vehicle_type TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bảng lịch trình
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      trip_date DATE NOT NULL,
      departure_point TEXT NOT NULL,
      destination_point TEXT NOT NULL,
      km_start REAL NOT NULL,
      km_end REAL NOT NULL,
      km_total REAL,
      notes TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES users(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )
  `);

  // Kiểm tra và thêm dữ liệu mẫu nếu chưa có
  seedData();
}

// Thêm dữ liệu mẫu ban đầu
function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

  if (userCount.count === 0) {
    // Mã hóa mật khẩu cho các tài khoản mẫu
    const adminPass = bcrypt.hashSync('Admin@123', 10);
    const ketoanPass = bcrypt.hashSync('Ketoan@123', 10);
    const quanlyPass = bcrypt.hashSync('Quanly@123', 10);
    const laixePass = bcrypt.hashSync('Laixe@123', 10);

    // Thêm người dùng mẫu
    const insertUser = db.prepare(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)'
    );

    insertUser.run('admin', adminPass, 'Quản Trị Viên', 'admin');
    insertUser.run('ketoan1', ketoanPass, 'Nguyễn Kế Toán', 'accountant');
    insertUser.run('quanly1', quanlyPass, 'Trần Quản Lý', 'fleet_manager');
    insertUser.run('laixe1', laixePass, 'Lê Văn Lái', 'driver');
    insertUser.run('laixe2', laixePass, 'Phạm Thị Xe', 'driver');

    console.log('✅ Đã thêm dữ liệu người dùng mẫu');
  }

  const vehicleCount = db.prepare('SELECT COUNT(*) as count FROM vehicles').get();

  if (vehicleCount.count === 0) {
    // Thêm phương tiện mẫu
    const insertVehicle = db.prepare(
      'INSERT INTO vehicles (license_plate, vehicle_type, notes) VALUES (?, ?, ?)'
    );

    insertVehicle.run('51A-12345', 'Xe tải', 'Xe tải 5 tấn');
    insertVehicle.run('51B-67890', 'Xe khách', 'Xe khách 16 chỗ');
    insertVehicle.run('51C-11111', 'Xe con', 'Xe con 4 chỗ');

    console.log('✅ Đã thêm dữ liệu phương tiện mẫu');
  }
}

// Khởi tạo database khi module được load
initializeDatabase();

module.exports = db;
