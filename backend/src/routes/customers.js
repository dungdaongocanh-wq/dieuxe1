// Route quản lý khách hàng
const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// Tất cả routes yêu cầu xác thực
router.use(authenticateToken);

/**
 * GET /api/customers
 * Lấy danh sách khách hàng (tất cả roles)
 */
router.get('/', (req, res) => {
  try {
    const customers = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
    res.json(customers);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách khách hàng:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * GET /api/customers/:id
 * Lấy chi tiết 1 khách hàng
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }
    res.json(customer);
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết khách hàng:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * POST /api/customers
 * Tạo khách hàng mới (admin, fleet_manager)
 */
router.post('/', requireRole('admin', 'fleet_manager'), (req, res) => {
  try {
    const { short_name, company_name, address, tax_code, email, is_active } = req.body;

    // Kiểm tra dữ liệu bắt buộc
    if (!short_name || !company_name) {
      return res.status(400).json({ message: 'Tên viết tắt và tên công ty là bắt buộc' });
    }

    // Kiểm tra mã số thuế không trùng (nếu có nhập)
    if (tax_code) {
      const existing = db.prepare('SELECT id FROM customers WHERE tax_code = ?').get(tax_code);
      if (existing) {
        return res.status(400).json({ message: 'Mã số thuế đã tồn tại' });
      }
    }

    const result = db.prepare(
      'INSERT INTO customers (short_name, company_name, address, tax_code, email, is_active) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      short_name,
      company_name,
      address || null,
      tax_code || null,
      email || null,
      is_active !== undefined ? is_active : 1
    );

    const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newCustomer);
  } catch (err) {
    console.error('Lỗi khi tạo khách hàng:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * PUT /api/customers/:id
 * Cập nhật khách hàng (admin, fleet_manager)
 */
router.put('/:id', requireRole('admin', 'fleet_manager'), (req, res) => {
  try {
    const { id } = req.params;
    const { short_name, company_name, address, tax_code, email, is_active } = req.body;

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }

    // Kiểm tra mã số thuế không trùng với khách hàng khác
    if (tax_code && tax_code !== customer.tax_code) {
      const existing = db.prepare('SELECT id FROM customers WHERE tax_code = ? AND id != ?').get(tax_code, id);
      if (existing) {
        return res.status(400).json({ message: 'Mã số thuế đã tồn tại' });
      }
    }

    db.prepare(`
      UPDATE customers SET
        short_name = ?, company_name = ?, address = ?, tax_code = ?, email = ?, is_active = ?
      WHERE id = ?
    `).run(
      short_name || customer.short_name,
      company_name || customer.company_name,
      address !== undefined ? address : customer.address,
      tax_code !== undefined ? (tax_code || null) : customer.tax_code,
      email !== undefined ? (email || null) : customer.email,
      is_active !== undefined ? is_active : customer.is_active,
      id
    );

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Lỗi khi cập nhật khách hàng:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * DELETE /api/customers/:id
 * Xóa khách hàng (chỉ admin)
 * Không cho phép xóa nếu đang được dùng bởi user nào đó
 */
router.delete('/:id', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) {
      return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }

    // Kiểm tra có user nào đang dùng khách hàng này không
    const usedByUser = db.prepare('SELECT id FROM users WHERE customer_id = ?').get(id);
    if (usedByUser) {
      return res.status(400).json({ message: 'Không thể xóa khách hàng đang được liên kết với người dùng' });
    }

    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json({ message: 'Đã xóa khách hàng thành công' });
  } catch (err) {
    console.error('Lỗi khi xóa khách hàng:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
