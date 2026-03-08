// Component trang đăng nhập
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Chuyển hướng đến trang trước đó sau khi đăng nhập, mặc định là dashboard
  const from = location.state?.from?.pathname || '/dashboard';

  /**
   * Xử lý sự kiện đăng nhập
   */
  const API = import.meta.env.VITE_API_URL;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

  try {
    const response = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

      const data = await response.json();

      if (data.status !== "ok") {
        setError(data.message || "Sai tài khoản hoặc mật khẩu");
        setLoading(false);
        return;
      }

      login(data.user, data.token);
      navigate("/", { replace: true });
    } catch {
      setError('Không thể kết nối đến server. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo và tiêu đề */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🚗</div>
          <h1 className="text-2xl font-bold text-gray-800">Hệ Thống Theo Dõi</h1>
          <p className="text-gray-500 text-sm mt-1">Lịch Trình Hàng Ngày Của Lái Xe</p>
        </div>

        {/* Form đăng nhập */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Hiển thị thông báo lỗi */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Tên đăng nhập */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên đăng nhập
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Nhập tên đăng nhập"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>

          {/* Mật khẩu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Nhập mật khẩu"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>

          {/* Nút đăng nhập */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="loading-spinner w-4 h-4 border-2 border-white border-t-blue-200"></div>
                <span>Đang đăng nhập...</span>
              </>
            ) : (
              'Đăng Nhập'
            )}
          </button>
        </form>

        {/* Gợi ý tài khoản mẫu */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs font-semibold text-gray-600 mb-2">Tài khoản demo:</p>
          <div className="space-y-1 text-xs text-gray-500">
            <p>👑 Admin: <span className="font-mono">admin / Admin@123</span></p>
            <p>📊 Kế toán: <span className="font-mono">ketoan1 / Ketoan@123</span></p>
            <p>🚛 Quản lý: <span className="font-mono">quanly1 / Quanly@123</span></p>
            <p>🚗 Lái xe: <span className="font-mono">laixe1 / Laixe@123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
