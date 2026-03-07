// Route quản lý người dùng
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

// Tất cả routes yêu cầu xác thực
router.use(authenticateToken);

/**
 * GET /api/users
 * Lấy danh sách người dùng (admin, fleet_manager)
 * JOIN với bảng customers để trả về tên công ty
 */
router.get('/', requireRole('admin', 'fleet_manager'), (req, res) => {
  try {
    // Không trả về mật khẩu, JOIN với customers để lấy tên công ty
    const users = db.prepare(`
      SELECT
        u.id, u.username, u.full_name, u.date_of_birth,
        u.id_card_number, u.id_card_issued_by, u.id_card_issued_date,
        u.user_type, u.customer_id, u.position,
        u.role, u.is_active, u.created_at,
        c.short_name AS customer_short_name,
        c.company_name AS customer_company_name
      FROM users u
      LEFT JOIN customers c ON u.customer_id = c.id
      ORDER BY u.created_at DESC
    `).all();
    res.json(users);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách người dùng:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * POST /api/users
 * Tạo người dùng mới (chỉ admin)
 */
router.post('/', requireRole('admin'), (req, res) => {
  try {
    const {
      username, password, full_name, role,
      date_of_birth, id_card_number, id_card_issued_by, id_card_issued_date,
      user_type, customer_id, position
    } = req.body;

    // Kiểm tra dữ liệu bắt buộc
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
    }

    // Kiểm tra vai trò hợp lệ
    const validRoles = ['admin', 'accountant', 'fleet_manager', 'driver'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Vai trò không hợp lệ' });
    }

    // Kiểm tra loại người dùng hợp lệ
    const validUserTypes = ['driver', 'customer', 'manager'];
    const resolvedUserType = user_type || 'driver';
    if (!validUserTypes.includes(resolvedUserType)) {
      return res.status(400).json({ message: 'Loại người dùng không hợp lệ' });
    }

    // Kiểm tra username đã tồn tại chưa
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
    }

    // Kiểm tra customer_id hợp lệ nếu user_type = 'customer'
    if (resolvedUserType === 'customer' && customer_id) {
      const cust = db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id);
      if (!cust) {
        return res.status(400).json({ message: 'Khách hàng không tồn tại' });
      }
    }

    // Mã hóa mật khẩu
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO users (
        username, password, full_name, role,
        date_of_birth, id_card_number, id_card_issued_by, id_card_issued_date,
        user_type, customer_id, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      username, hashedPassword, full_name, role,
      date_of_birth || null, id_card_number || null,
      id_card_issued_by || null, id_card_issued_date || null,
      resolvedUserType,
      resolvedUserType === 'customer' ? (customer_id || null) : null,
      resolvedUserType === 'manager' ? (position || null) : null
    );

    const newUser = db.prepare(`
      SELECT
        u.id, u.username, u.full_name, u.date_of_birth,
        u.id_card_number, u.id_card_issued_by, u.id_card_issued_date,
        u.user_type, u.customer_id, u.position,
        u.role, u.is_active, u.created_at,
        c.short_name AS customer_short_name,
        c.company_name AS customer_company_name
      FROM users u
      LEFT JOIN customers c ON u.customer_id = c.id
      WHERE u.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newUser);
  } catch (err) {
    console.error('Lỗi khi tạo người dùng:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * PUT /api/users/:id
 * Cập nhật người dùng (chỉ admin)
 */
router.put('/:id', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const {
      username, password, full_name, role, is_active,
      date_of_birth, id_card_number, id_card_issued_by, id_card_issued_date,
      user_type, customer_id, position
    } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Kiểm tra username mới không trùng với người dùng khác
    if (username && username !== user.username) {
      const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
      if (existing) {
        return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
      }
    }

    // Nếu có mật khẩu mới thì mã hóa
    let hashedPassword = user.password;
    if (password) {
      hashedPassword = bcrypt.hashSync(password, 10);
    }

    // Xác định loại người dùng
    const resolvedUserType = user_type || user.user_type || 'driver';

    // Kiểm tra customer_id hợp lệ nếu user_type = 'customer'
    if (resolvedUserType === 'customer' && customer_id) {
      const cust = db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id);
      if (!cust) {
        return res.status(400).json({ message: 'Khách hàng không tồn tại' });
      }
    }

    // Tính toán giá trị customer_id và position để tránh nested ternary
    let resolvedCustomerId = null;
    if (resolvedUserType === 'customer') {
      resolvedCustomerId = customer_id !== undefined ? (customer_id || null) : user.customer_id;
    }

    let resolvedPosition = null;
    if (resolvedUserType === 'manager') {
      resolvedPosition = position !== undefined ? (position || null) : user.position;
    }

    db.prepare(`
      UPDATE users SET
        username = ?, password = ?, full_name = ?, role = ?, is_active = ?,
        date_of_birth = ?, id_card_number = ?, id_card_issued_by = ?, id_card_issued_date = ?,
        user_type = ?, customer_id = ?, position = ?
      WHERE id = ?
    `).run(
      username || user.username,
      hashedPassword,
      full_name || user.full_name,
      role || user.role,
      is_active !== undefined ? is_active : user.is_active,
      date_of_birth !== undefined ? (date_of_birth || null) : user.date_of_birth,
      id_card_number !== undefined ? (id_card_number || null) : user.id_card_number,
      id_card_issued_by !== undefined ? (id_card_issued_by || null) : user.id_card_issued_by,
      id_card_issued_date !== undefined ? (id_card_issued_date || null) : user.id_card_issued_date,
      resolvedUserType,
      resolvedCustomerId,
      resolvedPosition,
      id
    );

    const updated = db.prepare(`
      SELECT
        u.id, u.username, u.full_name, u.date_of_birth,
        u.id_card_number, u.id_card_issued_by, u.id_card_issued_date,
        u.user_type, u.customer_id, u.position,
        u.role, u.is_active, u.created_at,
        c.short_name AS customer_short_name,
        c.company_name AS customer_company_name
      FROM users u
      LEFT JOIN customers c ON u.customer_id = c.id
      WHERE u.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    console.error('Lỗi khi cập nhật người dùng:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

/**
 * DELETE /api/users/:id
 * Xóa người dùng (chỉ admin)
 */
router.delete('/:id', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;

    // Không cho phép xóa chính mình
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'Không thể xóa tài khoản của chính mình' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'Đã xóa người dùng thành công' });
  } catch (err) {
    console.error('Lỗi khi xóa người dùng:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
