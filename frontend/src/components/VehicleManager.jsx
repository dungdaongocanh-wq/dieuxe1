// Component quản lý phương tiện (xe)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// Form thêm/sửa phương tiện
function VehicleFormModal({ vehicle, onSave, onClose, getAuthHeaders }) {
  const [formData, setFormData] = useState({
    license_plate: vehicle?.license_plate || '',
    vehicle_type: vehicle?.vehicle_type || '',
    notes: vehicle?.notes || '',
    is_active: vehicle?.is_active !== undefined ? vehicle.is_active : 1
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = vehicle ? `/api/vehicles/${vehicle.id}` : '/api/vehicles';
      const method = vehicle ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        return;
      }

      onSave(data, !!vehicle);
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
          {vehicle ? '✏️ Sửa Phương Tiện' : '➕ Thêm Phương Tiện'}
        </h3>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Biển Số Xe <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.license_plate}
              onChange={e => setFormData(f => ({ ...f, license_plate: e.target.value }))}
              required
              placeholder="VD: 51A-12345"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại Xe</label>
            <input
              type="text"
              value={formData.vehicle_type}
              onChange={e => setFormData(f => ({ ...f, vehicle_type: e.target.value }))}
              placeholder="VD: Xe tải, Xe khách..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi Chú</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Mô tả thêm về phương tiện..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active === 1}
              onChange={e => setFormData(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Đang hoạt động</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Đang lưu...' : (vehicle ? 'Cập nhật' : 'Thêm mới')}
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

function VehicleManager() {
  const { getAuthHeaders, user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const res = await fetch('/api/vehicles', { headers: getAuthHeaders() });
      if (res.ok) setVehicles(await res.json());
    } catch (err) {
      console.error('Lỗi khi tải phương tiện:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Xử lý sau khi lưu phương tiện (thêm mới hoặc cập nhật)
   */
  const handleSave = (savedVehicle, isEdit) => {
    if (isEdit) {
      setVehicles(prev => prev.map(v => v.id === savedVehicle.id ? savedVehicle : v));
      setMessage('✅ Đã cập nhật phương tiện thành công');
    } else {
      setVehicles(prev => [savedVehicle, ...prev]);
      setMessage('✅ Đã thêm phương tiện mới thành công');
    }
    setShowModal(false);
    setEditingVehicle(null);
    setTimeout(() => setMessage(''), 3000);
  };

  /**
   * Xóa phương tiện
   */
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (res.ok) {
        setVehicles(prev => prev.filter(v => v.id !== id));
        setMessage('✅ Đã xóa phương tiện thành công');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ ${data.message}`);
        setTimeout(() => setMessage(''), 4000);
      }
      setConfirmDelete(null);
    } catch {
      setMessage('❌ Không thể kết nối đến server');
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Quản Lý Phương Tiện</h1>
        <button
          onClick={() => { setEditingVehicle(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Thêm Phương Tiện
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

      {/* Bảng phương tiện */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto mb-3"></div>
            <p className="text-gray-500">Đang tải...</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">🚗</div>
            <p>Chưa có phương tiện nào</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['STT', 'Biển Số Xe', 'Loại Xe', 'Ghi Chú', 'Trạng Thái', 'Ngày Thêm', 'Thao Tác'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map((vehicle, index) => (
                <tr key={vehicle.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-mono text-sm font-semibold">
                      {vehicle.license_plate}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{vehicle.vehicle_type || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{vehicle.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                      vehicle.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {vehicle.is_active ? 'Hoạt động' : 'Ngừng hoạt động'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(vehicle.created_at).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingVehicle(vehicle); setShowModal(true); }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors text-sm"
                        title="Sửa"
                      >
                        ✏️
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setConfirmDelete(vehicle.id)}
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
        )}
      </div>

      {/* Modal thêm/sửa */}
      {showModal && (
        <VehicleFormModal
          vehicle={editingVehicle}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingVehicle(null); }}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {/* Xác nhận xóa */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-5xl mb-3">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Xác Nhận Xóa</h3>
            <p className="text-gray-600 text-sm mb-4">Bạn có chắc muốn xóa phương tiện này?</p>
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

export default VehicleManager;
