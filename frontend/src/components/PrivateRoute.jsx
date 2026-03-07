// Component điều hướng bảo vệ - chuyển hướng đến trang đăng nhập nếu chưa xác thực
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Bảo vệ các routes yêu cầu đăng nhập
 * Nếu chưa xác thực, chuyển hướng đến /login
 * Có thể giới hạn theo danh sách vai trò được phép
 */
function PrivateRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Hiển thị loading trong khi kiểm tra trạng thái xác thực
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-3"></div>
          <p className="text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Chưa đăng nhập - chuyển đến trang login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Kiểm tra quyền theo vai trò nếu có chỉ định
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">Không có quyền truy cập</h2>
          <p className="text-gray-600">Bạn không có quyền xem trang này.</p>
        </div>
      </div>
    );
  }

  return children;
}

export default PrivateRoute;
