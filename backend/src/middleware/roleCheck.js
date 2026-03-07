// Middleware kiểm tra quyền hạn của người dùng theo vai trò

/**
 * Tạo middleware kiểm tra người dùng có vai trò được phép không
 * @param {...string} roles - Danh sách vai trò được phép
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Chưa xác thực' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Bạn không có quyền thực hiện thao tác này'
      });
    }

    next();
  };
}

module.exports = { requireRole };
