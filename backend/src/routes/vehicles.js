// Route quản lý phương tiện (xe)
const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// Tất cả routes yêu cầu xác thực
router.use(authenticateToken);

/**
 * GET /api/vehicles
 * Lấy danh sách tất cả phương tiện
 */
router.get('/', (req, res) => {
  try {
    const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY created_at DESC').all();
    res.json(vehicles);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách phương tiện:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * POST /api/vehicles
 * Thêm phương tiện mới (admin, fleet_manager)
 */
router.post('/', requireRole('admin', 'fleet_manager'), (req, res) => {
  try {
    const { license_plate, vehicle_type, notes, fuel_rate, payload_tons, registration_expiry, insurance_expiry } = req.body;

    if (!license_plate) {
      return res.status(400).json({ message: 'Biển số xe là bắt buộc' });
    }

    // Kiểm tra biển số đã tồn tại chưa
    const existing = db.prepare('SELECT id FROM vehicles WHERE license_plate = ?').get(license_plate);
    if (existing) {
      return res.status(400).json({ message: 'Biển số xe đã tồn tại' });
    }

    const result = db.prepare(
      'INSERT INTO vehicles (license_plate, vehicle_type, notes, fuel_rate, price_per_km, payload_tons, registration_expiry, insurance_expiry) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(license_plate, vehicle_type || null, notes || null,
          fuel_rate !== undefined ? parseFloat(fuel_rate) : 8.5,
          0, // price_per_km: ẩn khỏi form, dùng giá trị default 0
          payload_tons != null && payload_tons !== '' ? parseFloat(payload_tons) : null,
          registration_expiry || null,
          insurance_expiry || null);

    const newVehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newVehicle);
  } catch (err) {
    console.error('Lỗi khi thêm phương tiện:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * PUT /api/vehicles/:id
 * Cập nhật thông tin phương tiện (admin, fleet_manager)
 */
router.put('/:id', requireRole('admin', 'fleet_manager'), (req, res) => {
  try {
    const { id } = req.params;
    const { license_plate, vehicle_type, notes, is_active, fuel_rate, payload_tons, registration_expiry, insurance_expiry } = req.body;

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy phương tiện' });
    }

    // Kiểm tra biển số mới không trùng với xe khác
    if (license_plate && license_plate !== vehicle.license_plate) {
      const existing = db.prepare('SELECT id FROM vehicles WHERE license_plate = ? AND id != ?').get(license_plate, id);
      if (existing) {
        return res.status(400).json({ message: 'Biển số xe đã tồn tại' });
      }
    }

    db.prepare(`
      UPDATE vehicles SET
        license_plate = ?, vehicle_type = ?, notes = ?, is_active = ?, fuel_rate = ?, price_per_km = ?,
        payload_tons = ?, registration_expiry = ?, insurance_expiry = ?
      WHERE id = ?
    `).run(
      license_plate || vehicle.license_plate,
      vehicle_type !== undefined ? vehicle_type : vehicle.vehicle_type,
      notes !== undefined ? notes : vehicle.notes,
      is_active !== undefined ? is_active : vehicle.is_active,
      fuel_rate !== undefined ? parseFloat(fuel_rate) : vehicle.fuel_rate,
      vehicle.price_per_km,
      payload_tons !== undefined ? (payload_tons != null && payload_tons !== '' ? parseFloat(payload_tons) : null) : vehicle.payload_tons,
      registration_expiry !== undefined ? (registration_expiry || null) : vehicle.registration_expiry,
      insurance_expiry !== undefined ? (insurance_expiry || null) : vehicle.insurance_expiry,
      id
    );

    const updated = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Lỗi khi cập nhật phương tiện:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * DELETE /api/vehicles/:id
 * Xóa phương tiện (chỉ admin)
 */
router.delete('/:id', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy phương tiện' });
    }

    // Kiểm tra phương tiện có đang được sử dụng trong lịch trình không
    const usedInSchedule = db.prepare('SELECT id FROM schedules WHERE vehicle_id = ? LIMIT 1').get(id);
    if (usedInSchedule) {
      return res.status(400).json({
        message: 'Không thể xóa phương tiện đang được sử dụng trong lịch trình'
      });
    }

    db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
    res.json({ message: 'Đã xóa phương tiện thành công' });
  } catch (err) {
    console.error('Lỗi khi xóa phương tiện:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
