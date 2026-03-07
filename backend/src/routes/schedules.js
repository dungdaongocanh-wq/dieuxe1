// Route quản lý lịch trình chuyến đi của lái xe
const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// Tất cả routes yêu cầu xác thực
router.use(authenticateToken);

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
             v.vehicle_type
      FROM schedules s
      JOIN users u ON s.driver_id = u.id
      JOIN vehicles v ON s.vehicle_id = v.id
    `;

    const params = [];
    const conditions = [];

    // Lái xe chỉ xem lịch trình của mình
    if (req.user.role === 'driver') {
      conditions.push('s.driver_id = ?');
      params.push(req.user.id);
    }

    // Lọc theo ngày
    if (req.query.date) {
      conditions.push('s.trip_date = ?');
      params.push(req.query.date);
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
      notes
    } = req.body;

    // Xác định driver_id: driver chỉ được tạo cho chính mình
    const actualDriverId = req.user.role === 'driver' ? req.user.id : driver_id;

    // Kiểm tra dữ liệu bắt buộc
    if (!vehicle_id || !trip_date || !departure_point || !destination_point ||
        km_start === undefined || km_end === undefined) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }

    // Kiểm tra km_end >= km_start
    if (parseFloat(km_end) < parseFloat(km_start)) {
      return res.status(400).json({ message: 'Km kết thúc phải lớn hơn hoặc bằng Km bắt đầu' });
    }

    // Tính tổng km
    const km_total = parseFloat(km_end) - parseFloat(km_start);

    const result = db.prepare(`
      INSERT INTO schedules 
        (driver_id, vehicle_id, trip_date, departure_point, destination_point, km_start, km_end, km_total, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(actualDriverId, vehicle_id, trip_date, departure_point, destination_point,
           parseFloat(km_start), parseFloat(km_end), km_total, notes || null);

    // Lấy bản ghi vừa tạo kèm thông tin liên kết
    const newSchedule = db.prepare(`
      SELECT s.*, u.full_name as driver_name, v.license_plate, v.vehicle_type
      FROM schedules s
      JOIN users u ON s.driver_id = u.id
      JOIN vehicles v ON s.vehicle_id = v.id
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
      notes
    } = req.body;

    // Kiểm tra km_end >= km_start
    if (parseFloat(km_end) < parseFloat(km_start)) {
      return res.status(400).json({ message: 'Km kết thúc phải lớn hơn hoặc bằng Km bắt đầu' });
    }

    const km_total = parseFloat(km_end) - parseFloat(km_start);

    db.prepare(`
      UPDATE schedules SET
        vehicle_id = ?, trip_date = ?, departure_point = ?, destination_point = ?,
        km_start = ?, km_end = ?, km_total = ?, notes = ?
      WHERE id = ?
    `).run(vehicle_id, trip_date, departure_point, destination_point,
           parseFloat(km_start), parseFloat(km_end), km_total, notes || null, id);

    const updated = db.prepare(`
      SELECT s.*, u.full_name as driver_name, v.license_plate, v.vehicle_type
      FROM schedules s
      JOIN users u ON s.driver_id = u.id
      JOIN vehicles v ON s.vehicle_id = v.id
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
 * Xóa lịch trình (chỉ admin và fleet_manager)
 */
router.delete('/:id', requireRole('admin', 'fleet_manager'), (req, res) => {
  try {
    const { id } = req.params;
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);

    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch trình' });
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
 * Duyệt hoặc từ chối lịch trình (fleet_manager, admin)
 */
router.patch('/:id/status', requireRole('admin', 'fleet_manager'), (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }

    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch trình' });
    }

    db.prepare('UPDATE schedules SET status = ? WHERE id = ?').run(status, id);

    const updated = db.prepare(`
      SELECT s.*, u.full_name as driver_name, v.license_plate, v.vehicle_type
      FROM schedules s
      JOIN users u ON s.driver_id = u.id
      JOIN vehicles v ON s.vehicle_id = v.id
      WHERE s.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    console.error('Lỗi khi cập nhật trạng thái lịch trình:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
