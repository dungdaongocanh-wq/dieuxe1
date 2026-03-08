// Route quản lý lịch trình chuyến đi của lái xe
const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// Tất cả routes yêu cầu xác thực
router.use(authenticateToken);

/**
 * Tính kỳ thanh toán từ ngày chuyến đi
 * Kỳ = từ ngày 26 tháng trước → ngày 25 tháng hiện tại
 * @param {string} tripDate - Ngày chuyến đi dạng YYYY-MM-DD
 * @returns {{ periodStart: string, periodEnd: string }}
 */
function getBillingPeriod(tripDate) {
  const d = new Date(tripDate + 'T00:00:00');
  const day = d.getDate();
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();

  let periodStart, periodEnd;
  if (day >= 26) {
    // Từ ngày 26 tháng này → ngày 25 tháng sau
    periodStart = new Date(year, month, 26);
    periodEnd = new Date(year, month + 1, 25);
  } else {
    // Từ ngày 26 tháng trước → ngày 25 tháng này
    periodStart = new Date(year, month - 1, 26);
    periodEnd = new Date(year, month, 25);
  }

  const fmt = (dt) => dt.toISOString().split('T')[0];
  return { periodStart: fmt(periodStart), periodEnd: fmt(periodEnd) };
}

/**
 * Lấy tổng km xe đã chạy trong kỳ thanh toán (không tính chuyến bị rejected)
 * @param {number} vehicleId
 * @param {string} periodStart - YYYY-MM-DD
 * @param {string} periodEnd - YYYY-MM-DD
 * @param {number|null} excludeScheduleId - Loại trừ chuyến đang sửa
 * @returns {number}
 */
function getKmUsedInPeriod(vehicleId, periodStart, periodEnd, excludeScheduleId = null) {
  let sql = `SELECT COALESCE(SUM(km_total), 0) as total_km
             FROM schedules
             WHERE vehicle_id = ?
               AND status != 'rejected'
               AND trip_date >= ?
               AND trip_date <= ?`;
  const params = [vehicleId, periodStart, periodEnd];
  if (excludeScheduleId) {
    sql += ' AND id != ?';
    params.push(excludeScheduleId);
  }
  const row = db.prepare(sql).get(...params);
  return row ? (row.total_km || 0) : 0;
}

/**
 * Tính tiền chuyến đi dựa trên km và cấu hình giá
 * @param {number} kmTotal - Tổng số km chuyến này
 * @param {object} vehicle - Thông tin xe { price_per_km, fuel_rate }
 * @param {object|null} pricing - Cấu hình giá { combo_km_threshold, combo_price, price_per_km_after } hoặc null
 * @param {number} kmUsedInPeriod - Tổng km xe đã chạy trong kỳ (không tính chuyến này)
 * @returns {number} Số tiền trước thuế
 */
function calcAmount(kmTotal, vehicle, pricing, kmUsedInPeriod = 0) {
  const km = parseFloat(kmTotal) || 0;
  if (!pricing || !pricing.combo_km_threshold || pricing.combo_km_threshold === 0) {
    // Không có combo → tính theo đơn giá xe
    return km * (vehicle.price_per_km || 10000);
  }
  const threshold = parseFloat(pricing.combo_km_threshold);
  const comboPrice = parseFloat(pricing.combo_price) || 0;
  const afterPrice = parseFloat(pricing.price_per_km_after) || 0;
  const kmBefore = parseFloat(kmUsedInPeriod) || 0;
  const kmAfter = kmBefore + km;

  if (kmBefore >= threshold) {
    // Đã vượt ngưỡng combo từ trước → toàn bộ chuyến tính afterPrice
    return km * afterPrice;
  } else if (kmAfter <= threshold) {
    // Chưa vượt ngưỡng → toàn bộ chuyến tính comboPrice
    return km * comboPrice;
  } else {
    // Cắt ngang ngưỡng combo
    const kmInCombo = threshold - kmBefore;
    const kmOverCombo = kmAfter - threshold;
    return (kmInCombo * comboPrice) + (kmOverCombo * afterPrice);
  }
}

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

    // Lọc theo ngày bắt đầu
    if (req.query.date_from) {
      conditions.push('s.trip_date >= ?');
      params.push(req.query.date_from);
    }

    // Lọc theo ngày kết thúc
    if (req.query.date_to) {
      conditions.push('s.trip_date <= ?');
      params.push(req.query.date_to);
    }

    // Lọc theo loại xe
    if (req.query.vehicle_type) {
      conditions.push('v.vehicle_type LIKE ?');
      params.push('%' + req.query.vehicle_type + '%');
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

    // Lấy thông tin xe
    const vehicleData = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicle_id);
    // Lấy pricing config nếu có customer_id
    let pricing = null;
    if (customer_id) {
      pricing = db.prepare(
        'SELECT * FROM customer_vehicle_pricing WHERE customer_id = ? AND vehicle_id = ? ORDER BY id DESC LIMIT 1'
      ).get(customer_id, vehicle_id);
    }
    // Tính km xe đã chạy trong kỳ thanh toán (không tính chuyến này)
    const { periodStart, periodEnd } = getBillingPeriod(trip_date);
    const kmUsedInPeriod = getKmUsedInPeriod(vehicle_id, periodStart, periodEnd);
    // Tính thành tiền theo công thức đúng
    const amount_before_tax = calcAmount(km_total, vehicleData || {}, pricing, kmUsedInPeriod);
    const fuelRate = vehicleData ? (vehicleData.fuel_rate || 8.5) : 8.5;
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
 * GET /api/schedules/pricing-preview
 * Preview giá chuyến dựa trên xe, khách hàng, số km và ngày chuyến
 * Query params: vehicle_id, customer_id (optional), km_total, trip_date (optional, default hôm nay), schedule_id (optional)
 */
router.get('/pricing-preview', (req, res) => {
  try {
    const { vehicle_id, customer_id, km_total, trip_date, schedule_id } = req.query;
    if (!vehicle_id || !km_total) {
      return res.status(400).json({ message: 'Thiếu vehicle_id hoặc km_total' });
    }
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicle_id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }
    let pricing = null;
    if (customer_id) {
      pricing = db.prepare(
        'SELECT * FROM customer_vehicle_pricing WHERE customer_id = ? AND vehicle_id = ? ORDER BY id DESC LIMIT 1'
      ).get(customer_id, vehicle_id);
    }
    // Tính kỳ thanh toán và km đã dùng trong kỳ
    const effectiveTripDate = trip_date || new Date().toISOString().split('T')[0];
    const billingPeriod = getBillingPeriod(effectiveTripDate);
    const kmUsedInPeriod = getKmUsedInPeriod(vehicle_id, billingPeriod.periodStart, billingPeriod.periodEnd, schedule_id || null);
    const amount = calcAmount(parseFloat(km_total), vehicle, pricing, kmUsedInPeriod);
    const pricingType = (pricing && pricing.combo_km_threshold > 0) ? 'combo' : 'per_km';
    res.json({
      amount_before_tax: parseFloat(amount.toFixed(0)),
      pricing_type: pricingType,
      pricing_detail: pricing || { price_per_km: vehicle.price_per_km },
      km_used_in_period: kmUsedInPeriod,
      billing_period: billingPeriod
    });
  } catch (err) {
    console.error('Lỗi khi preview giá:', err);
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

    // Lấy thông tin xe và pricing config
    const actualVehicleId = vehicle_id || schedule.vehicle_id;
    const vehicleData = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(actualVehicleId);
    const actualCustomerId = customer_id !== undefined ? (customer_id || null) : schedule.customer_id;
    let pricing = null;
    if (actualCustomerId) {
      pricing = db.prepare(
        'SELECT * FROM customer_vehicle_pricing WHERE customer_id = ? AND vehicle_id = ? ORDER BY id DESC LIMIT 1'
      ).get(actualCustomerId, actualVehicleId);
    }
    // Tính km xe đã chạy trong kỳ thanh toán (loại trừ chuyến đang sửa)
    const actualTripDate = trip_date || schedule.trip_date;
    const { periodStart, periodEnd } = getBillingPeriod(actualTripDate);
    const kmUsedInPeriod = getKmUsedInPeriod(actualVehicleId, periodStart, periodEnd, id);
    // Tính thành tiền theo công thức đúng
    const amount_before_tax = calcAmount(km_total, vehicleData || {}, pricing, kmUsedInPeriod);
    const fuelRate = vehicleData ? (vehicleData.fuel_rate || 8.5) : 8.5;
    const fuel_consumed = km_total * fuelRate / 100;

    db.prepare(`
      UPDATE schedules SET
        vehicle_id = ?, trip_date = ?, departure_point = ?, destination_point = ?,
        km_start = ?, km_end = ?, km_total = ?, amount_before_tax = ?, fuel_consumed = ?, notes = ?,
        customer_id = ?, toll_fee = ?
      WHERE id = ?
    `).run(actualVehicleId, trip_date, departure_point, destination_point,
           parseFloat(km_start), parseFloat(km_end), km_total, amount_before_tax, fuel_consumed, notes || null,
           actualCustomerId,
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
 * GET /api/schedules/export/monthly
 * Xuất danh sách lịch trình theo tháng kèm tổng hợp
 * Query params: month (YYYY-MM), vehicle_id, driver_id, customer_id
 */
router.get('/export/monthly', requireRole('admin', 'fleet_manager', 'accountant'), (req, res) => {
  try {
    const conditions = [];
    const params = [];

    // Lọc theo tháng
    if (req.query.month) {
      conditions.push("strftime('%Y-%m', s.trip_date) = ?");
      params.push(req.query.month);
    }

    // Lọc theo phương tiện
    if (req.query.vehicle_id) {
      conditions.push('s.vehicle_id = ?');
      params.push(req.query.vehicle_id);
    }

    // Lọc theo lái xe
    if (req.query.driver_id) {
      conditions.push('s.driver_id = ?');
      params.push(req.query.driver_id);
    }

    // Lọc theo khách hàng
    if (req.query.customer_id) {
      conditions.push('s.customer_id = ?');
      params.push(req.query.customer_id);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const schedules = db.prepare(`
      SELECT s.*,
             u.full_name as driver_name,
             u.username as driver_username,
             v.license_plate,
             v.vehicle_type,
             v.fuel_rate,
             v.price_per_km,
             c.short_name as customer_short_name,
             c.company_name as customer_company_name
      FROM schedules s
      JOIN users u ON s.driver_id = u.id
      JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ${where}
      ORDER BY s.trip_date ASC, s.created_at ASC
    `).all(...params);

    // Tổng hợp
    const summary = schedules.reduce((acc, s) => ({
      total_trips: acc.total_trips + 1,
      total_km: acc.total_km + (s.km_total || 0),
      total_toll_fee: acc.total_toll_fee + (s.toll_fee || 0),
      total_fuel_consumed: acc.total_fuel_consumed + (s.fuel_consumed || 0),
      total_amount: acc.total_amount + (s.amount_before_tax || 0)
    }), { total_trips: 0, total_km: 0, total_toll_fee: 0, total_fuel_consumed: 0, total_amount: 0 });

    res.json({ schedules, summary });
  } catch (err) {
    console.error('Lỗi khi xuất báo cáo tháng:', err);
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

/**
 * GET /api/schedules/combo-min-check
 * Kiểm tra phí tối thiểu combo cho từng xe trong một kỳ thanh toán
 * Query params: period_start, period_end (hoặc month YYYY-MM), vehicle_id (optional), customer_id (optional)
 */
router.get('/combo-min-check', requireRole('admin', 'fleet_manager', 'accountant'), (req, res) => {
  try {
    let { period_start, period_end, month, vehicle_id, customer_id } = req.query;

    // Tính kỳ từ tháng nếu không có period_start/period_end
    if (month && (!period_start || !period_end)) {
      const [yr, mo] = month.split('-').map(Number);
      const prevMonth = mo === 1 ? 12 : mo - 1;
      const prevYear = mo === 1 ? yr - 1 : yr;
      period_start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-26`;
      period_end = `${yr}-${String(mo).padStart(2, '0')}-25`;
    }

    if (!period_start || !period_end) {
      return res.status(400).json({ message: 'Thiếu period_start và period_end (hoặc month)' });
    }

    const conditions = [
      's.status != ?',
      's.trip_date >= ?',
      's.trip_date <= ?',
      's.customer_id IS NOT NULL',
      'cvp.combo_km_threshold > 0'
    ];
    const params = ['rejected', period_start, period_end];

    if (vehicle_id) {
      conditions.push('s.vehicle_id = ?');
      params.push(vehicle_id);
    }
    if (customer_id) {
      conditions.push('s.customer_id = ?');
      params.push(customer_id);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const rows = db.prepare(`
      SELECT
        v.id as vehicle_id,
        v.license_plate,
        v.price_per_km,
        c.id as customer_id,
        c.short_name as customer_short_name,
        cvp.combo_km_threshold,
        cvp.combo_price,
        cvp.price_per_km_after,
        COALESCE(SUM(s.km_total), 0) as total_km_in_period,
        COALESCE(SUM(s.amount_before_tax), 0) as total_amount_actual
      FROM schedules s
      JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN customer_vehicle_pricing cvp ON cvp.id = (
        SELECT MAX(id) FROM customer_vehicle_pricing
        WHERE customer_id = s.customer_id AND vehicle_id = s.vehicle_id
      )
      ${where}
      GROUP BY s.vehicle_id, s.customer_id
      ORDER BY v.license_plate
    `).all(...params);

    const result = rows.map(row => {
      const threshold = parseFloat(row.combo_km_threshold) || 0;
      const comboPrice = parseFloat(row.combo_price) || 0;
      const afterPrice = parseFloat(row.price_per_km_after) || 0;
      const totalKm = parseFloat(row.total_km_in_period) || 0;
      const totalAmountActual = parseFloat(row.total_amount_actual) || 0;
      const pricePerKm = parseFloat(row.price_per_km) || 10000;

      // Tính tổng tiền theo công thức combo tích lũy toàn kỳ
      let totalAmountCombo;
      if (!threshold || threshold === 0) {
        // Không có combo → tính theo đơn giá xe
        totalAmountCombo = totalKm * pricePerKm;
      } else if (totalKm <= threshold) {
        totalAmountCombo = totalKm * comboPrice;
      } else {
        totalAmountCombo = (threshold * comboPrice) + ((totalKm - threshold) * afterPrice);
      }

      const minAmount = threshold * comboPrice;
      const isBelow = totalAmountActual < minAmount;
      const finalAmount = isBelow ? minAmount : totalAmountActual;
      const adjustment = isBelow ? (minAmount - totalAmountActual) : 0;
      return {
        vehicle_id: row.vehicle_id,
        license_plate: row.license_plate,
        customer_id: row.customer_id,
        customer_short_name: row.customer_short_name,
        combo_km_threshold: threshold,
        combo_price: comboPrice,
        price_per_km_after: afterPrice,
        price_per_km: pricePerKm,
        total_km_in_period: totalKm,
        total_amount_actual: totalAmountActual,
        total_amount_combo: Math.round(totalAmountCombo),
        min_amount: minAmount,
        final_amount: finalAmount,
        is_below_minimum: isBelow,
        adjustment,
        period_start,
        period_end
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Lỗi combo-min-check:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * POST /api/schedules/recalculate
 * Tính lại amount_before_tax cho các chuyến trong khoảng thời gian (chỉ admin)
 * Body: { date_from, date_to, vehicle_id?, customer_id?, dry_run? }
 */
router.post('/recalculate', requireRole('admin'), (req, res) => {
  try {
    const { date_from, date_to, vehicle_id, customer_id, dry_run } = req.body;

    if (!date_from || !date_to) {
      return res.status(400).json({ message: 'Thiếu date_from hoặc date_to' });
    }

    // Xây dựng điều kiện lọc
    const conditions = [
      "s.status != 'rejected'",
      's.trip_date >= ?',
      's.trip_date <= ?'
    ];
    const params = [date_from, date_to];

    if (vehicle_id) {
      conditions.push('s.vehicle_id = ?');
      params.push(vehicle_id);
    }
    if (customer_id) {
      conditions.push('s.customer_id = ?');
      params.push(customer_id);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    // Lấy danh sách schedules, sort theo trip_date ASC, created_at ASC
    const schedules = db.prepare(`
      SELECT s.*, u.full_name as driver_name, v.license_plate, v.fuel_rate, v.price_per_km
      FROM schedules s
      JOIN users u ON s.driver_id = u.id
      JOIN vehicles v ON s.vehicle_id = v.id
      ${where}
      ORDER BY s.trip_date ASC, s.created_at ASC
    `).all(...params);

    const results = [];

    for (const schedule of schedules) {
      // Lấy pricing config nếu có customer_id
      let pricing = null;
      if (schedule.customer_id) {
        pricing = db.prepare(
          'SELECT * FROM customer_vehicle_pricing WHERE customer_id = ? AND vehicle_id = ? ORDER BY id DESC LIMIT 1'
        ).get(schedule.customer_id, schedule.vehicle_id);
      }

      // Tính kỳ thanh toán cho chuyến này
      const { periodStart, periodEnd } = getBillingPeriod(schedule.trip_date);

      // Tính km đã dùng trong kỳ (loại trừ chuyến hiện tại, chỉ các chuyến trước trong kỳ)
      const kmUsedInPeriod = getKmUsedInPeriod(schedule.vehicle_id, periodStart, periodEnd, schedule.id);

      // Tính lại amount
      const vehicleData = { price_per_km: schedule.price_per_km, fuel_rate: schedule.fuel_rate };
      const new_amount_rounded = Math.round(calcAmount(schedule.km_total, vehicleData, pricing, kmUsedInPeriod));
      const fuelRate = schedule.fuel_rate || 8.5;
      const new_fuel_consumed = schedule.km_total * fuelRate / 100;

      const old_amount = schedule.amount_before_tax;
      const old_amount_rounded = old_amount != null ? Math.round(old_amount) : null;
      const changed = new_amount_rounded !== old_amount_rounded;

      results.push({
        id: schedule.id,
        trip_date: schedule.trip_date,
        license_plate: schedule.license_plate,
        driver_name: schedule.driver_name,
        old_amount: old_amount,
        new_amount: new_amount_rounded,
        changed
      });

      // Nếu không phải dry_run, cập nhật DB ngay (thứ tự quan trọng)
      if (!dry_run) {
        db.prepare(
          'UPDATE schedules SET amount_before_tax = ?, fuel_consumed = ? WHERE id = ?'
        ).run(new_amount_rounded, new_fuel_consumed, schedule.id);
      }
    }

    res.json({
      updated_count: results.filter(r => r.changed).length,
      dry_run: !!dry_run,
      date_from,
      date_to,
      results
    });
  } catch (err) {
    console.error('Lỗi khi tính lại giá:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
