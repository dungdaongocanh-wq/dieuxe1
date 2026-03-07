// Component quản lý người dùng (chỉ dành cho admin)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// Nhãn hiển thị cho từng vai trò
const roleLabels = {
  admin: '👑 Quản Trị Viên',
  accountant: '📊 Kế Toán',
  fleet_manager: '🚛 Quản Lý Xe',
  driver: '🚗 Lái Xe'
};

// Form thêm/sửa người dùng
function UserFormModal({ userToEdit, onSave, onClose, getAuthHeaders }) {
  const [formData, setFormData] = useState({
    username: userToEdit?.username || '',
    password: '',
    full_name: userToEdit?.full_name || '',
    role: userToEdit?.role || 'driver',
    is_active: userToEdit?.is_active !== undefined ? userToEdit.is_active : 1
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Khi thêm mới, mật khẩu bắt buộc
    if (!userToEdit && !formData.password) {
      setError('Mật khẩu là bắt buộc khi tạo người dùng mới');
      return;
    }

    setLoading(true);

    try {
      const url = userToEdit ? `/api/users/${userToEdit.id}` : '/api/users';
      const method = userToEdit ? 'PUT' : 'POST';

      // Nếu không nhập mật khẩu khi sửa thì không gửi field password
      const payload = { ...formData };
      if (userToEdit && !formData.password) {
        delete payload.password;
      }

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        return;
      }

      onSave(data, !!userToEdit);
    } catch {
      setError('Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {userToEdit ? '✏️ Sửa Người Dùng' : '➕ Thêm Người Dùng'}
        </h3>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên đăng nhập <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={e => setFormData(f => ({ ...f, username: e.target.value }))}
                required
                placeholder="username"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu {!userToEdit && <span className="text-red-500">*</span>}
                {userToEdit && <span className="text-xs text-gray-400">(để trống = không đổi)</span>}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                placeholder={userToEdit ? '(Giữ nguyên)' : 'Mật khẩu mới'}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={e => setFormData(f => ({ ...f, full_name: e.target.value }))}
              required
              placeholder="Nguyễn Văn A"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vai trò <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={e => setFormData(f => ({ ...f, role: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="driver">🚗 Lái Xe</option>
              <option value="accountant">📊 Kế Toán</option>
              <option value="fleet_manager">🚛 Quản Lý Xe</option>
              <option value="admin">👑 Quản Trị Viên</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="user_is_active"
              checked={formData.is_active === 1}
              onChange={e => setFormData(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="user_is_active" className="text-sm text-gray-700">Tài khoản đang hoạt động</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Đang lưu...' : (userToEdit ? 'Cập nhật' : 'Thêm mới')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2.5 rounded-lg transition-colors"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserManager() {
  const { getAuthHeaders, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', { headers: getAuthHeaders() });
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error('Lỗi khi tải người dùng:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Xử lý sau khi lưu người dùng
   */
  const handleSave = (savedUser, isEdit) => {
    if (isEdit) {
      setUsers(prev => prev.map(u => u.id === savedUser.id ? savedUser : u));
      setMessage('✅ Đã cập nhật người dùng thành công');
    } else {
      setUsers(prev => [savedUser, ...prev]);
      setMessage('✅ Đã thêm người dùng mới thành công');
    }
    setShowModal(false);
    setEditingUser(null);
    setTimeout(() => setMessage(''), 3000);
  };

  /**
   * Xóa người dùng
   */
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
        setMessage('✅ Đã xóa người dùng thành công');
      } else {
        setMessage(`❌ ${data.message}`);
      }
      setTimeout(() => setMessage(''), 3000);
      setConfirmDelete(null);
    } catch {
      setMessage('❌ Không thể kết nối đến server');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Quản Lý Người Dùng</h1>
        <button
          onClick={() => { setEditingUser(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Thêm Người Dùng
        </button>
      </div>

      {/* Thông báo */}
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          message.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* Bảng người dùng */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto mb-3"></div>
            <p className="text-gray-500">Đang tải...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">👥</div>
            <p>Chưa có người dùng nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['STT', 'Tên đăng nhập', 'Họ và Tên', 'Vai Trò', 'Trạng Thái', 'Ngày Tạo', 'Thao Tác'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u, index) => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${u.id === currentUser?.id ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-gray-800">{u.username}</span>
                      {u.id === currentUser?.id && (
                        <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">Bạn</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{u.full_name}</td>
                    <td className="px-4 py-3 text-sm">{roleLabels[u.role]}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.is_active ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingUser(u); setShowModal(true); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors text-sm"
                          title="Sửa"
                        >
                          ✏️
                        </button>
                        {/* Không cho phép xóa chính mình */}
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => setConfirmDelete(u.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors text-sm"
                            title="Xóa"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal thêm/sửa */}
      {showModal && (
        <UserFormModal
          userToEdit={editingUser}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingUser(null); }}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {/* Xác nhận xóa */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-5xl mb-3">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Xác Nhận Xóa</h3>
            <p className="text-gray-600 text-sm mb-4">Bạn có chắc muốn xóa người dùng này? Thao tác này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium"
              >
                Xóa
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 rounded-lg font-medium"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManager;
