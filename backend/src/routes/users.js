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
 */
router.get('/', requireRole('admin', 'fleet_manager'), (req, res) => {
  try {
    // Không trả về mật khẩu
    const users = db.prepare(
      'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
    ).all();
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
    const { username, password, full_name, role } = req.body;

    // Kiểm tra dữ liệu bắt buộc
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
    }

    // Kiểm tra vai trò hợp lệ
    const validRoles = ['admin', 'accountant', 'fleet_manager', 'driver'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Vai trò không hợp lệ' });
    }

    // Kiểm tra username đã tồn tại chưa
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
    }

    // Mã hóa mật khẩu
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)'
    ).run(username, hashedPassword, full_name, role);

    const newUser = db.prepare(
      'SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);

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
    const { username, password, full_name, role, is_active } = req.body;

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

    db.prepare(`
      UPDATE users SET
        username = ?, password = ?, full_name = ?, role = ?, is_active = ?
      WHERE id = ?
    `).run(
      username || user.username,
      hashedPassword,
      full_name || user.full_name,
      role || user.role,
      is_active !== undefined ? is_active : user.is_active,
      id
    );

    const updated = db.prepare(
      'SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?'
    ).get(id);

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
