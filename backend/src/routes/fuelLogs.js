// Route quản lý nạp nhiên liệu
const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// Tất cả routes yêu cầu xác thực
router.use(authenticateToken);

/**
 * GET /api/fuel-logs/stats/monthly
 * Thống kê tổng hợp theo xe trong tháng
 */
router.get('/stats/monthly', requireRole('admin', 'fleet_manager', 'accountant', 'driver'), (req, res) => {
  try {
    const { month, vehicle_id } = req.query;

    let query = `
      SELECT
        fl.vehicle_id,
        v.license_plate,
        SUM(fl.liters) AS total_liters,
        SUM(fl.total_cost) AS total_cost,
        COUNT(*) AS refuel_count
      FROM fuel_logs fl
      JOIN vehicles v ON v.id = fl.vehicle_id
      WHERE 1=1
    `;
    const params = [];

    if (month) {
      query += ` AND strftime('%Y-%m', fl.refuel_date) = ?`;
      params.push(month);
    }
    if (vehicle_id) {
      query += ` AND fl.vehicle_id = ?`;
      params.push(vehicle_id);
    }
    // driver chỉ xem của mình
    if (req.user.role === 'driver') {
      query += ` AND fl.driver_id = ?`;
      params.push(req.user.id);
    }

    query += ` GROUP BY fl.vehicle_id, v.license_plate ORDER BY v.license_plate`;

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    console.error('Lỗi khi lấy thống kê nhiên liệu:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * GET /api/fuel-logs
 * Lấy danh sách nhật ký nạp nhiên liệu
 * Query params: month, vehicle_id, driver_id, date_from, date_to
 */
router.get('/', requireRole('admin', 'fleet_manager', 'accountant', 'driver'), (req, res) => {
  try {
    const { month, vehicle_id, driver_id, date_from, date_to } = req.query;

    let query = `
      SELECT
        fl.id, fl.driver_id, fl.vehicle_id, fl.refuel_date,
        fl.liters, fl.unit_price, fl.total_cost,
        fl.attachment_name, fl.attachment_type, fl.notes, fl.created_at,
        CASE WHEN fl.attachment IS NOT NULL THEN 1 ELSE 0 END AS has_attachment,
        u.full_name AS driver_name,
        v.license_plate,
        v.vehicle_type
      FROM fuel_logs fl
      JOIN users u ON u.id = fl.driver_id
      JOIN vehicles v ON v.id = fl.vehicle_id
      WHERE 1=1
    `;
    const params = [];

    // driver chỉ xem của mình
    if (req.user.role === 'driver') {
      query += ` AND fl.driver_id = ?`;
      params.push(req.user.id);
    } else if (driver_id) {
      query += ` AND fl.driver_id = ?`;
      params.push(driver_id);
    }

    if (vehicle_id) {
      query += ` AND fl.vehicle_id = ?`;
      params.push(vehicle_id);
    }
    if (month) {
      query += ` AND strftime('%Y-%m', fl.refuel_date) = ?`;
      params.push(month);
    }
    if (date_from) {
      query += ` AND fl.refuel_date >= ?`;
      params.push(date_from);
    }
    if (date_to) {
      query += ` AND fl.refuel_date <= ?`;
      params.push(date_to);
    }

    query += ` ORDER BY fl.refuel_date DESC, fl.id DESC`;

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách nhiên liệu:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * GET /api/fuel-logs/:id/attachment
 * Tải file đính kèm của bản ghi nhiên liệu
 */
router.get('/:id/attachment', requireRole('admin', 'fleet_manager', 'accountant', 'driver'), (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM fuel_logs WHERE id = ?').get(id);

    if (!row) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    }

    // driver chỉ xem của mình
    if (req.user.role === 'driver' && row.driver_id !== req.user.id) {
      return res.status(403).json({ message: 'Không có quyền truy cập' });
    }

    if (!row.attachment) {
      return res.status(404).json({ message: 'Không có file đính kèm' });
    }

    // attachment được lưu dạng base64 string
    const buffer = Buffer.from(row.attachment, 'base64');
    res.set('Content-Type', row.attachment_type || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${row.attachment_name || 'attachment'}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Lỗi khi tải file đính kèm:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * POST /api/fuel-logs
 * Thêm bản ghi nạp nhiên liệu mới
 */
router.post('/', requireRole('admin', 'fleet_manager', 'driver'), (req, res) => {
  try {
    let {
      driver_id, vehicle_id, refuel_date, liters, unit_price,
      notes, attachment_base64, attachment_name, attachment_type
    } = req.body;

    // driver chỉ được tạo cho mình
    if (req.user.role === 'driver') {
      driver_id = req.user.id;
    }

    // Validate bắt buộc
    if (!vehicle_id || !refuel_date || !liters || !unit_price) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc: vehicle_id, refuel_date, liters, unit_price' });
    }
    if (parseFloat(liters) <= 0) {
      return res.status(400).json({ message: 'Số lít phải lớn hơn 0' });
    }
    if (parseFloat(unit_price) <= 0) {
      return res.status(400).json({ message: 'Đơn giá phải lớn hơn 0' });
    }
    if (!driver_id) {
      return res.status(400).json({ message: 'Thiếu thông tin lái xe' });
    }

    // Server tính total_cost
    const total_cost = parseFloat(liters) * parseFloat(unit_price);

    const result = db.prepare(`
      INSERT INTO fuel_logs
        (driver_id, vehicle_id, refuel_date, liters, unit_price, total_cost, attachment, attachment_name, attachment_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      driver_id, vehicle_id, refuel_date,
      parseFloat(liters), parseFloat(unit_price), total_cost,
      attachment_base64 || null,
      attachment_name || null,
      attachment_type || null,
      notes || null
    );

    const newRow = db.prepare(`
      SELECT fl.id, fl.driver_id, fl.vehicle_id, fl.refuel_date,
        fl.liters, fl.unit_price, fl.total_cost,
        fl.attachment_name, fl.attachment_type, fl.notes, fl.created_at,
        CASE WHEN fl.attachment IS NOT NULL THEN 1 ELSE 0 END AS has_attachment,
        u.full_name AS driver_name, v.license_plate, v.vehicle_type
      FROM fuel_logs fl
      JOIN users u ON u.id = fl.driver_id
      JOIN vehicles v ON v.id = fl.vehicle_id
      WHERE fl.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newRow);
  } catch (err) {
    console.error('Lỗi khi thêm bản ghi nhiên liệu:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * PUT /api/fuel-logs/:id
 * Cập nhật bản ghi nạp nhiên liệu
 */
router.put('/:id', requireRole('admin', 'fleet_manager', 'driver'), (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM fuel_logs WHERE id = ?').get(id);

    if (!row) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    }

    // driver chỉ sửa của mình
    if (req.user.role === 'driver' && row.driver_id !== req.user.id) {
      return res.status(403).json({ message: 'Không có quyền chỉnh sửa bản ghi này' });
    }

    const {
      driver_id, vehicle_id, refuel_date, liters, unit_price,
      notes, attachment_base64, attachment_name, attachment_type
    } = req.body;

    const newLiters = liters !== undefined ? parseFloat(liters) : row.liters;
    const newUnitPrice = unit_price !== undefined ? parseFloat(unit_price) : row.unit_price;
    const total_cost = newLiters * newUnitPrice;

    // driver không thể thay đổi driver_id
    const newDriverId = req.user.role === 'driver' ? row.driver_id : (driver_id || row.driver_id);

    db.prepare(`
      UPDATE fuel_logs SET
        driver_id = ?, vehicle_id = ?, refuel_date = ?,
        liters = ?, unit_price = ?, total_cost = ?,
        attachment = ?, attachment_name = ?, attachment_type = ?,
        notes = ?
      WHERE id = ?
    `).run(
      newDriverId,
      vehicle_id || row.vehicle_id,
      refuel_date || row.refuel_date,
      newLiters, newUnitPrice, total_cost,
      attachment_base64 !== undefined ? (attachment_base64 || null) : row.attachment,
      attachment_name !== undefined ? (attachment_name || null) : row.attachment_name,
      attachment_type !== undefined ? (attachment_type || null) : row.attachment_type,
      notes !== undefined ? (notes || null) : row.notes,
      id
    );

    const updated = db.prepare(`
      SELECT fl.id, fl.driver_id, fl.vehicle_id, fl.refuel_date,
        fl.liters, fl.unit_price, fl.total_cost,
        fl.attachment_name, fl.attachment_type, fl.notes, fl.created_at,
        CASE WHEN fl.attachment IS NOT NULL THEN 1 ELSE 0 END AS has_attachment,
        u.full_name AS driver_name, v.license_plate, v.vehicle_type
      FROM fuel_logs fl
      JOIN users u ON u.id = fl.driver_id
      JOIN vehicles v ON v.id = fl.vehicle_id
      WHERE fl.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    console.error('Lỗi khi cập nhật bản ghi nhiên liệu:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * DELETE /api/fuel-logs/:id
 * Xóa bản ghi nạp nhiên liệu (admin, fleet_manager)
 */
router.delete('/:id', requireRole('admin', 'fleet_manager'), (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT id FROM fuel_logs WHERE id = ?').get(id);

    if (!row) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    }

    db.prepare('DELETE FROM fuel_logs WHERE id = ?').run(id);
    res.json({ message: 'Đã xóa bản ghi thành công' });
  } catch (err) {
    console.error('Lỗi khi xóa bản ghi nhiên liệu:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
