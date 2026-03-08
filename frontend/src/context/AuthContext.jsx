// Context quản lý trạng thái xác thực người dùng toàn ứng dụng
import React, { createContext, useContext, useState, useEffect } from 'react';

// Tạo context xác thực
const AuthContext = createContext(null);

/**
 * Provider cung cấp trạng thái xác thực cho toàn bộ ứng dụng
 */
export function AuthProvider({ children }) {
  const API = import.meta.env.VITE_API_URL || '';
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Khôi phục trạng thái đăng nhập từ localStorage khi tải trang
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        // Dữ liệu không hợp lệ, xóa đi
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
  }, []);

  /**
   * Đăng nhập: lưu token và thông tin user vào state và localStorage
   */
  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };

  /**
   * Đăng xuất: xóa token và thông tin user
   */
  const logout = async () => {
  try {
    if (token) {
      await fetch(`${API}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  } catch {
  } finally {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }
};

  /**
   * Tạo headers xác thực cho các API calls
   */
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    getAuthHeaders,
    isAuthenticated: !!user && !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook tiện ích để sử dụng AuthContext
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng trong AuthProvider');
  }
  return context;
}

export default AuthContext;
