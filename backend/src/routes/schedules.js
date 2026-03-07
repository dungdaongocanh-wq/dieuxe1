// Route quản lý lịch trình chuyến đi của lái xe
const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// Tất cả routes yêu cầu xác thực
router.use(authenticateToken);

/**
 * GET /api/schedules/stats/by-customer
 * Thống kê tổng hợp theo khách hàng
 * Nhận query params: month (YYYY-MM), vehicle_id, driver_id
 */
router.get('/stats/by-customer', requireRole('admin', 'fleet_manager', 'accountant'), (req, res) => {
  try {
    const conditions = ['c.id IS NOT NULL'];
    const params = [];

    if (req.query.month) {
      conditions.push("strftime('%Y-%m', s.trip_date) = ?");
      params.push(req.query.month);
    }
    if (req.query.vehicle_id) {
      conditions.push('s.vehicle_id = ?');
      params.push(req.query.vehicle_id);
    }
    if (req.query.driver_id) {
      conditions.push('s.driver_id = ?');
      params.push(req.query.driver_id);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const stats = db.prepare(`
      SELECT
        c.id as customer_id,
        c.short_name as customer_short_name,
        c.company_name as customer_company_name,
        COUNT(s.id) as total_trips,
        COALESCE(SUM(s.km_total), 0) as total_km,
        COALESCE(SUM(s.toll_fee), 0) as total_toll_fee,
        COALESCE(SUM(s.fuel_consumed), 0) as total_fuel_consumed
      FROM schedules s
      JOIN customers c ON s.customer_id = c.id
      ${where}
      GROUP BY c.id, c.short_name, c.company_name
      ORDER BY c.short_name
    `).all(...params);

    res.json(stats);
  } catch (err) {
    console.error('Lỗi khi lấy thống kê theo khách hàng:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * GET /api/schedules
 * Lấy danh sách lịch trình
 * - Driver chỉ xem lịch trình của mình
 * - Các vai trò khác xem tất cả
 */
router.get('/', (req, res) => {
  try {
    let query = `
      SELECT s.*, 
             u.full_name as driver_name, 
             u.username as driver_username,
             v.license_plate, 
             v.vehicle_type,
             v.fuel_rate,
             v.price_per_km,
             c.short_name as customer_short_name,
             c.company_name as customer_company_name,
             s.approved_by,
             s.approved_at,
             s.rejection_reason
      FROM schedules s
      JOIN users u ON s.driver_id = u.id
      JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN customers c ON s.customer_id = c.id
    `;

    const params = [];
    const conditions = [];

    // Lái xe chỉ xem lịch trình của mình
    if (req.user.role === 'driver') {
      conditions.push('s.driver_id = ?');
      params.push(req.user.id);
    }

    // Customer chỉ xem lịch trình của công ty mình
    if (req.user.role === 'customer') {
      const userInfo = db.prepare('SELECT customer_id FROM users WHERE id = ?').get(req.user.id);
      if (userInfo?.customer_id) {
        conditions.push('s.customer_id = ?');
        params.push(userInfo.customer_id);
      } else {
        return res.json([]);
      }
    } else if (req.query.customer_id) {
      conditions.push('s.customer_id = ?');
      params.push(req.query.customer_id);
    }

    // Lọc theo ngày
    if (req.query.date) {
      conditions.push('s.trip_date = ?');
      params.push(req.query.date);
    }

    // Lọc theo tháng (YYYY-MM)
    if (req.query.month) {
      conditions.push("strftime('%Y-%m', s.trip_date) = ?");
      params.push(req.query.month);
    }

    // Lọc theo năm
    if (req.query.year) {
      conditions.push("strftime('%Y', s.trip_date) = ?");
      params.push(req.query.year);
    }

    // Lọc theo lái xe (chỉ admin/fleet_manager/accountant)
    if (req.query.driver_id && req.user.role !== 'driver') {
      conditions.push('s.driver_id = ?');
      params.push(req.query.driver_id);
    }

    // Lọc theo phương tiện
    if (req.query.vehicle_id) {
      conditions.push('s.vehicle_id = ?');
      params.push(req.query.vehicle_id);
    }

    // Lọc theo trạng thái
    if (req.query.status) {
      conditions.push('s.status = ?');
      params.push(req.query.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.trip_date DESC, s.created_at DESC';

    const schedules = db.prepare(query).all(...params);
    res.json(schedules);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách lịch trình:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * POST /api/schedules
 * Tạo lịch trình mới
 */
router.post('/', requireRole('admin', 'fleet_manager', 'driver'), (req, res) => {
  try {
    const {
      driver_id,
      vehicle_id,
      trip_date,
      departure_point,
      destination_point,
      km_start,
      km_end,
      notes,
      customer_id,
      toll_fee
    } = req.body;

    // Xác định driver_id: driver chỉ được tạo cho chính mình
    const actualDriverId = req.user.role === 'driver' ? req.user.id : driver_id;

    // Kiểm tra dữ liệu bắt buộc
    if (!vehicle_id || !trip_date || !departure_point || !destination_point ||
        km_start === undefined || km_end === undefined || !customer_id) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }

    // Kiểm tra km_end >= km_start
    if (parseFloat(km_end) < parseFloat(km_start)) {
      return res.status(400).json({ message: 'Km kết thúc phải lớn hơn hoặc bằng Km bắt đầu' });
    }

    // Tính tổng km
    const km_total = parseFloat(km_end) - parseFloat(km_start);

    // Lấy định mức xăng và đơn giá từ xe
    const vehicle = db.prepare('SELECT fuel_rate, price_per_km FROM vehicles WHERE id = ?').get(vehicle_id);
    const fuelRate = vehicle ? (vehicle.fuel_rate || 8.5) : 8.5;
    const pricePerKm = vehicle ? (vehicle.price_per_km || 10000) : 10000;

    // Tính thành tiền và xăng tiêu thụ
    const amount_before_tax = km_total * pricePerKm;
    const fuel_consumed = km_total * fuelRate / 100;

    const result = db.prepare(`
      INSERT INTO schedules 
        (driver_id, vehicle_id, trip_date, departure_point, destination_point, km_start, km_end, km_total, amount_before_tax, fuel_consumed, notes, status, customer_id, toll_fee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(actualDriverId, vehicle_id, trip_date, departure_point, destination_point,
           parseFloat(km_start), parseFloat(km_end), km_total, amount_before_tax, fuel_consumed, notes || null,
           customer_id || null, parseFloat(toll_fee) || 0);

    // Lấy bản ghi vừa tạo kèm thông tin liên kết
    const newSchedule = db.prepare(`
      SELECT s.*, u.full_name as driver_name, v.license_plate, v.vehicle_type, v.fuel_rate, v.price_per_km,
             c.short_name as customer_short_name, c.company_name as customer_company_name
      FROM schedules s
      JOIN users u ON s.driver_id = u.id
      JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newSchedule);
  } catch (err) {
    console.error('Lỗi khi tạo lịch trình:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * PUT /api/schedules/:id
 * Cập nhật lịch trình
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Lấy lịch trình hiện tại
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch trình' });
    }

    // Driver chỉ được sửa lịch trình của mình và khi còn pending
    if (req.user.role === 'driver') {
      if (schedule.driver_id !== req.user.id) {
        return res.status(403).json({ message: 'Bạn không có quyền sửa lịch trình này' });
      }
      if (schedule.status !== 'pending') {
        return res.status(400).json({ message: 'Chỉ có thể sửa lịch trình đang chờ duyệt' });
      }
    }

    const {
      vehicle_id,
      trip_date,
      departure_point,
      destination_point,
      km_start,
      km_end,
      notes,
      customer_id,
      toll_fee
    } = req.body;

    // Kiểm tra km_end >= km_start
    if (parseFloat(km_end) < parseFloat(km_start)) {
      return res.status(400).json({ message: 'Km kết thúc phải lớn hơn hoặc bằng Km bắt đầu' });
    }

    const km_total = parseFloat(km_end) - parseFloat(km_start);

    // Lấy định mức xăng và đơn giá từ xe
    const actualVehicleId = vehicle_id || schedule.vehicle_id;
    const vehicle = db.prepare('SELECT fuel_rate, price_per_km FROM vehicles WHERE id = ?').get(actualVehicleId);
    const fuelRate = vehicle ? (vehicle.fuel_rate || 8.5) : 8.5;
    const pricePerKm = vehicle ? (vehicle.price_per_km || 10000) : 10000;

    const amount_before_tax = km_total * pricePerKm;
    const fuel_consumed = km_total * fuelRate / 100;

    db.prepare(`
      UPDATE schedules SET
        vehicle_id = ?, trip_date = ?, departure_point = ?, destination_point = ?,
        km_start = ?, km_end = ?, km_total = ?, amount_before_tax = ?, fuel_consumed = ?, notes = ?,
        customer_id = ?, toll_fee = ?
      WHERE id = ?
    `).run(actualVehicleId, trip_date, departure_point, destination_point,
           parseFloat(km_start), parseFloat(km_end), km_total, amount_before_tax, fuel_consumed, notes || null,
           customer_id !== undefined ? (customer_id || null) : schedule.customer_id,
           toll_fee !== undefined ? (parseFloat(toll_fee) || 0) : (schedule.toll_fee || 0),
           id);

    const updated = db.prepare(`
      SELECT s.*, u.full_name as driver_name, v.license_plate, v.vehicle_type, v.fuel_rate, v.price_per_km,
             c.short_name as customer_short_name, c.company_name as customer_company_name
      FROM schedules s
      JOIN users u ON s.driver_id = u.id
      JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    console.error('Lỗi khi cập nhật lịch trình:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * DELETE /api/schedules/:id
 * Xóa lịch trình (admin và fleet_manager, nhưng chỉ admin xóa được chuyến đã duyệt)
 */
router.delete('/:id', requireRole('admin', 'fleet_manager'), (req, res) => {
  try {
    const { id } = req.params;
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);

    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch trình' });
    }

    // Chỉ admin được xóa chuyến đã duyệt
    if (schedule.status === 'approved' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin mới có thể xóa chuyến đã được duyệt' });
    }

    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    res.json({ message: 'Đã xóa lịch trình thành công' });
  } catch (err) {
    console.error('Lỗi khi xóa lịch trình:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * PATCH /api/schedules/:id/status
 * Duyệt hoặc từ chối lịch trình
 * Cho phép: admin, fleet_manager, accountant, customer
 */
router.patch('/:id/status', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;
    const allowedRoles = ['admin', 'fleet_manager', 'accountant', 'customer'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Không có quyền' });
    }

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }

    if (status === 'rejected' && !rejection_reason?.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập lý do từ chối' });
    }

    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    if (!schedule) return res.status(404).json({ message: 'Không tìm thấy lịch trình' });

    // Nếu là customer, kiểm tra chỉ được duyệt chuyến của công ty mình
    if (req.user.role === 'customer') {
      const userInfo = db.prepare('SELECT customer_id FROM users WHERE id = ?').get(req.user.id);
      if (!userInfo?.customer_id || schedule.customer_id !== userInfo.customer_id) {
        return res.status(403).json({ message: 'Không có quyền duyệt chuyến này' });
      }
    }

    const approvedBy = (status === 'approved' || status === 'rejected') ? req.user.full_name : null;
    const approvedAt = (status === 'approved' || status === 'rejected') ? new Date().toISOString() : null;
    const reason = status === 'rejected' ? rejection_reason.trim() : null;

    db.prepare('UPDATE schedules SET status = ?, approved_by = ?, approved_at = ?, rejection_reason = ? WHERE id = ?')
      .run(status, approvedBy, approvedAt, reason, id);

    const updated = db.prepare(`
      SELECT s.*, u.full_name as driver_name, v.license_plate, v.vehicle_type, v.fuel_rate, v.price_per_km,
             c.short_name as customer_short_name, c.company_name as customer_company_name
      FROM schedules s
      JOIN users u ON s.driver_id = u.id
      JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).get(id);
    res.json(updated);
  } catch (err) {
    console.error('Lỗi khi cập nhật trạng thái:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
