// Route xác thực: đăng nhập và đăng xuất
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/db');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Đăng nhập và trả về JWT token
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Kiểm tra dữ liệu đầu vào
  if (!username || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
  }

  // Tìm người dùng trong database
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);

  if (!user) {
    return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
  }

  // Kiểm tra mật khẩu
  const isValidPassword = bcrypt.compareSync(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
  }

  // Tạo JWT token với thời hạn 24 giờ
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      customer_id: user.customer_id || null
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      customer_id: user.customer_id || null
    }
  });
});

/**
 * POST /api/auth/logout
 * Đăng xuất (phía client xóa token)
 */
router.post('/logout', authenticateToken, (req, res) => {
  // JWT stateless - client chịu trách nhiệm xóa token
  res.json({ message: 'Đăng xuất thành công' });
});

module.exports = router;
