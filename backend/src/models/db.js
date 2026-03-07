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
      user_type TEXT NOT NULL DEFAULT 'driver',
      customer_id INTEGER,
      position TEXT,
      role TEXT NOT NULL DEFAULT 'driver',
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

  // Migration: Xóa CHECK constraint trên cột role để cho phép role='customer'
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (tableInfo && tableInfo.sql && tableInfo.sql.includes('CHECK(role IN')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          date_of_birth DATE,
          id_card_number TEXT,
          id_card_issued_by TEXT,
          id_card_issued_date DATE,
          user_type TEXT NOT NULL DEFAULT 'driver',
          customer_id INTEGER,
          position TEXT,
          role TEXT NOT NULL DEFAULT 'driver',
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
      `);
      db.exec('INSERT OR IGNORE INTO users_new SELECT * FROM users');
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_new RENAME TO users');
      console.log('✅ Đã migration bảng users: xóa CHECK constraint trên role');
    }
  } catch (e) {
    console.error('Migration users table error:', e.message);
  }

  // Bảng phương tiện
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_plate TEXT UNIQUE NOT NULL,
      vehicle_type TEXT,
      notes TEXT,
      fuel_rate REAL DEFAULT 8.5,
      price_per_km REAL DEFAULT 10000,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: thêm cột fuel_rate và price_per_km vào vehicles nếu chưa có
  const vehicleColumns = db.pragma('table_info(vehicles)').map(c => c.name);
  if (!vehicleColumns.includes('fuel_rate')) {
    db.exec('ALTER TABLE vehicles ADD COLUMN fuel_rate REAL DEFAULT 8.5');
  }
  if (!vehicleColumns.includes('price_per_km')) {
    db.exec('ALTER TABLE vehicles ADD COLUMN price_per_km REAL DEFAULT 10000');
  }
  if (!vehicleColumns.includes('payload_tons')) {
    db.exec('ALTER TABLE vehicles ADD COLUMN payload_tons REAL');
  }
  if (!vehicleColumns.includes('registration_expiry')) {
    db.exec('ALTER TABLE vehicles ADD COLUMN registration_expiry DATE');
  }
  if (!vehicleColumns.includes('insurance_expiry')) {
    db.exec('ALTER TABLE vehicles ADD COLUMN insurance_expiry DATE');
  }

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
      amount_before_tax REAL,
      fuel_consumed REAL,
      notes TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES users(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )
  `);

  // Migration: thêm cột amount_before_tax và fuel_consumed vào schedules nếu chưa có
  const scheduleColumns = db.pragma('table_info(schedules)').map(c => c.name);
  if (!scheduleColumns.includes('amount_before_tax')) {
    db.exec('ALTER TABLE schedules ADD COLUMN amount_before_tax REAL');
  }
  if (!scheduleColumns.includes('fuel_consumed')) {
    db.exec('ALTER TABLE schedules ADD COLUMN fuel_consumed REAL');
  }
  if (!scheduleColumns.includes('customer_id')) {
    db.exec('ALTER TABLE schedules ADD COLUMN customer_id INTEGER REFERENCES customers(id)');
  }
  if (!scheduleColumns.includes('toll_fee')) {
    db.exec('ALTER TABLE schedules ADD COLUMN toll_fee REAL DEFAULT 0');
  }
  if (!scheduleColumns.includes('approved_by')) {
    db.exec('ALTER TABLE schedules ADD COLUMN approved_by TEXT');
  }
  if (!scheduleColumns.includes('approved_at')) {
    db.exec('ALTER TABLE schedules ADD COLUMN approved_at DATETIME');
  }
  if (!scheduleColumns.includes('rejection_reason')) {
    db.exec('ALTER TABLE schedules ADD COLUMN rejection_reason TEXT');
  }

  // Bảng cấu hình giá theo xe / khách hàng
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_vehicle_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      combo_km_threshold REAL,
      combo_price REAL,
      price_per_km_after REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
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
    const driverPass = bcrypt.hashSync('Driver@123', 10);

    // Thêm người dùng mẫu
    const insertUser = db.prepare(
      'INSERT INTO users (username, password, full_name, role, user_type, position) VALUES (?, ?, ?, ?, ?, ?)'
    );

    insertUser.run('admin', adminPass, 'Quản Trị Viên', 'admin', 'manager', 'Giám đốc');
    insertUser.run('ketoan', ketoanPass, 'Nguyễn Kế Toán', 'accountant', 'manager', 'Kế Toán Trưởng');
    insertUser.run('quanly', quanlyPass, 'Trần Quản Lý', 'fleet_manager', 'manager', 'Trưởng Phòng');
    insertUser.run('nguyenvankham', driverPass, 'Nguyễn Văn Khám', 'driver', 'driver', null);
    insertUser.run('tranthimai', driverPass, 'Trần Thị Mai', 'driver', 'driver', null);

    console.log('✅ Đã thêm dữ liệu người dùng mẫu');
  }

  const vehicleCount = db.prepare('SELECT COUNT(*) as count FROM vehicles').get();

  if (vehicleCount.count === 0) {
    // Thêm phương tiện mẫu
    const insertVehicle = db.prepare(
      'INSERT INTO vehicles (license_plate, vehicle_type, fuel_rate, price_per_km) VALUES (?, ?, ?, ?)'
    );

    insertVehicle.run('99C-123.45', 'Xe tải', 8.5, 10000);
    insertVehicle.run('99C-678.90', 'Xe khách', 9.0, 12000);

    console.log('✅ Đã thêm dữ liệu phương tiện mẫu');
  }
}

// Khởi tạo database khi module được load
initializeDatabase();

module.exports = db;
