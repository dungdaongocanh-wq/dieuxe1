// Component thanh điều hướng chính
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Nhãn hiển thị cho từng vai trò
const roleLabels = {
  admin: '👑 Quản Trị Viên',
  accountant: '📊 Kế Toán',
  fleet_manager: '🚛 Quản Lý Xe',
  driver: '🚗 Lái Xe'
};

function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * Xử lý đăng xuất
   */
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  /**
   * Kiểm tra link có đang active không
   */
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  /**
   * Xác định các menu items dựa trên vai trò người dùng
   */
  const getNavItems = () => {
    const items = [
      { path: '/dashboard', label: '📊 Tổng Quan', roles: ['admin', 'accountant', 'fleet_manager', 'driver'] },
      { path: '/schedules', label: '📋 Lịch Trình', roles: ['admin', 'accountant', 'fleet_manager', 'driver'] },
      { path: '/vehicles', label: '🚗 Phương Tiện', roles: ['admin', 'fleet_manager'] },
      { path: '/users', label: '👥 Người Dùng', roles: ['admin'] },
    ];

    return items.filter(item => item.roles.includes(user?.role));
  };

  return (
    <nav className="bg-blue-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg">
            <span className="text-2xl">🚌</span>
            <span className="hidden sm:block">DieuXe</span>
          </Link>

          {/* Navigation links - desktop */}
          <div className="hidden md:flex items-center gap-1">
            {getNavItems().map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-blue-900 text-white'
                    : 'text-blue-100 hover:bg-blue-600'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* User info và logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold">{user?.full_name}</p>
              <p className="text-xs text-blue-200">{roleLabels[user?.role]}</p>
            </div>

            <button
              onClick={handleLogout}
              className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              Đăng xuất
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-1 rounded-md hover:bg-blue-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-3 space-y-1">
            <p className="text-blue-200 text-xs px-3 py-1">{user?.full_name} - {roleLabels[user?.role]}</p>
            {getNavItems().map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  isActive(item.path) ? 'bg-blue-900' : 'hover:bg-blue-600'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
