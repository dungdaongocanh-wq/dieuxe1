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
  // Bảng khách hàng (phải tạo TRƯỚC bảng users vì users có FK → customers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      address TEXT,
      tax_code TEXT UNIQUE,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bảng người dùng
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      date_of_birth DATE,
      id_card_number TEXT,
      id_card_issued_by TEXT,
      id_card_issued_date DATE,
      user_type TEXT NOT NULL DEFAULT 'driver' CHECK(user_type IN ('driver', 'customer', 'manager')),
      customer_id INTEGER,
      position TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'accountant', 'fleet_manager', 'driver')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  // Migration: thêm các cột mới vào bảng users nếu chưa có (cho database đã tồn tại)
  const userColumns = db.pragma('table_info(users)').map(c => c.name);
  if (!userColumns.includes('date_of_birth')) {
    db.exec('ALTER TABLE users ADD COLUMN date_of_birth DATE');
  }
  if (!userColumns.includes('id_card_number')) {
    db.exec('ALTER TABLE users ADD COLUMN id_card_number TEXT');
  }
  if (!userColumns.includes('id_card_issued_by')) {
    db.exec('ALTER TABLE users ADD COLUMN id_card_issued_by TEXT');
  }
  if (!userColumns.includes('id_card_issued_date')) {
    db.exec('ALTER TABLE users ADD COLUMN id_card_issued_date DATE');
  }
  if (!userColumns.includes('user_type')) {
    // Thêm cột không có NOT NULL để tương thích với mọi phiên bản SQLite
    db.exec("ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'driver'");
  }
  if (!userColumns.includes('customer_id')) {
    db.exec('ALTER TABLE users ADD COLUMN customer_id INTEGER');
  }
  if (!userColumns.includes('position')) {
    db.exec('ALTER TABLE users ADD COLUMN position TEXT');
  }

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
  // Thêm khách hàng mẫu nếu chưa có
  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get();
  if (customerCount.count === 0) {
    const insertCustomer = db.prepare(
      'INSERT INTO customers (short_name, company_name, address, tax_code, email) VALUES (?, ?, ?, ?, ?)'
    );
    insertCustomer.run('HANSOL', 'Công ty TNHH Hansol Vina', 'Khu công nghiệp Tiên Sơn, Bắc Ninh', '0301234567', 'contact@hansol.vn');
    insertCustomer.run('ILS-TECH', 'Công ty CP ILS Technology', 'Khu công nghiệp Hạp Lĩnh, Bắc Ninh', '0307654321', '');
    insertCustomer.run('SEVT', 'Samsung Electronics Việt Nam Thái Nguyên', 'KCN Samsung, Thái Nguyên', '0200123456', 'sevt@samsung.com');
    console.log('✅ Đã thêm dữ liệu khách hàng mẫu');
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

  if (userCount.count === 0) {
    // Mã hóa mật khẩu cho các tài khoản mẫu
    const adminPass = bcrypt.hashSync('Admin@123', 10);
    const ketoanPass = bcrypt.hashSync('Ketoan@123', 10);
    const quanlyPass = bcrypt.hashSync('Quanly@123', 10);
    const laixePass = bcrypt.hashSync('Laixe@123', 10);

    // Thêm người dùng mẫu
    const insertUser = db.prepare(
      'INSERT INTO users (username, password, full_name, role, user_type, position) VALUES (?, ?, ?, ?, ?, ?)'
    );

    insertUser.run('admin', adminPass, 'Quản Trị Viên', 'admin', 'manager', 'Giám đốc');
    insertUser.run('ketoan1', ketoanPass, 'Nguyễn Kế Toán', 'accountant', 'manager', 'Kế Toán Trưởng');
    insertUser.run('quanly1', quanlyPass, 'Trần Quản Lý', 'fleet_manager', 'manager', 'Trưởng Phòng');
    insertUser.run('laixe1', laixePass, 'Lê Văn Lái', 'driver', 'driver', null);
    insertUser.run('laixe2', laixePass, 'Phạm Thị Xe', 'driver', 'driver', null);

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
