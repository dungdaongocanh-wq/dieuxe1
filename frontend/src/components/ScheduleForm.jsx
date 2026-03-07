// Component form thêm/sửa lịch trình
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ScheduleForm() {
  const { id } = useParams(); // Có id = chế độ sửa
  const navigate = useNavigate();
  const { getAuthHeaders, user } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  // Dữ liệu form
  const [formData, setFormData] = useState({
    driver_id: '',
    vehicle_id: '',
    trip_date: new Date().toISOString().split('T')[0], // Mặc định hôm nay
    departure_point: '',
    destination_point: '',
    km_start: '',
    km_end: '',
    km_total: '',
    notes: ''
  });

  const isEdit = !!id;

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  /**
   * Tải dữ liệu ban đầu (phương tiện, lái xe, và dữ liệu chỉnh sửa nếu có)
   */
  const fetchInitialData = async () => {
    try {
      const headers = getAuthHeaders();
      const promises = [fetch('/api/vehicles', { headers })];

      // Nếu là admin hoặc fleet_manager, tải danh sách lái xe
      if (['admin', 'fleet_manager'].includes(user?.role)) {
        promises.push(fetch('/api/users', { headers }));
      }

      // Nếu đang sửa, tải dữ liệu lịch trình
      if (isEdit) {
        promises.push(fetch('/api/schedules', { headers }));
      }

      const results = await Promise.all(promises);
      const vehiclesData = await results[0].json();
      setVehicles(vehiclesData.filter(v => v.is_active));

      if (['admin', 'fleet_manager'].includes(user?.role) && results[1]) {
        const usersData = await results[1].json();
        setDrivers(usersData.filter(u => u.role === 'driver' && u.is_active));
      }

      if (isEdit) {
        const schedulesData = await results[results.length - 1].json();
        const schedule = schedulesData.find(s => s.id === parseInt(id));
        if (schedule) {
          setFormData({
            driver_id: schedule.driver_id,
            vehicle_id: schedule.vehicle_id,
            trip_date: schedule.trip_date,
            departure_point: schedule.departure_point,
            destination_point: schedule.destination_point,
            km_start: schedule.km_start,
            km_end: schedule.km_end,
            km_total: schedule.km_total,
            notes: schedule.notes || ''
          });
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu:', err);
      setError('Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoadingData(false);
    }
  };

  /**
   * Xử lý thay đổi giá trị input
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };

    // Tự động tính tổng Km khi km_start hoặc km_end thay đổi
    if (name === 'km_start' || name === 'km_end') {
      const start = parseFloat(name === 'km_start' ? value : newData.km_start) || 0;
      const end = parseFloat(name === 'km_end' ? value : newData.km_end) || 0;
      newData.km_total = end >= start ? (end - start).toFixed(1) : '';
    }

    setFormData(newData);
  };

  /**
   * Xử lý submit form
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Kiểm tra km hợp lệ
    if (parseFloat(formData.km_end) < parseFloat(formData.km_start)) {
      setError('Km kết thúc phải lớn hơn hoặc bằng Km bắt đầu');
      return;
    }

    setLoading(true);

    try {
      const url = isEdit ? `/api/schedules/${id}` : '/api/schedules';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = { ...formData };
      // Nếu driver tạo lịch trình, không cần gửi driver_id
      if (user?.role === 'driver') {
        delete payload.driver_id;
      }

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Có lỗi xảy ra');
        return;
      }

      navigate('/schedules');
    } catch {
      setError('Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Tiêu đề */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/schedules')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          ← Quay lại
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          {isEdit ? 'Sửa Lịch Trình' : 'Thêm Lịch Trình Mới'}
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Lái xe - chỉ hiển thị nếu là admin hoặc fleet_manager */}
          {['admin', 'fleet_manager'].includes(user?.role) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lái Xe <span className="text-red-500">*</span>
              </label>
              <select
                name="driver_id"
                value={formData.driver_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Chọn lái xe --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name} ({d.username})</option>
                ))}
              </select>
            </div>
          )}

          {/* Ngày và xe - 2 cột */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="trip_date"
                value={formData.trip_date}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phương Tiện <span className="text-red-500">*</span>
              </label>
              <select
                name="vehicle_id"
                value={formData.vehicle_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Chọn xe --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.license_plate} - {v.vehicle_type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Điểm đi và điểm đến */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Điểm Đi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="departure_point"
                value={formData.departure_point}
                onChange={handleChange}
                required
                placeholder="VD: Garage công ty"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Điểm Đến <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="destination_point"
                value={formData.destination_point}
                onChange={handleChange}
                required
                placeholder="VD: Kho hàng A"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Km */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Km Bắt Đầu <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="km_start"
                value={formData.km_start}
                onChange={handleChange}
                required
                min="0"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Km Kết Thúc <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="km_end"
                value={formData.km_end}
                onChange={handleChange}
                required
                min="0"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tổng Km (tự tính)
              </label>
              <input
                type="text"
                value={formData.km_total}
                readOnly
                placeholder="Tự động tính"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ghi Chú
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Ghi chú thêm về chuyến đi (tùy chọn)..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="loading-spinner w-4 h-4 border-2 border-white border-t-blue-200"></div>
                  Đang lưu...
                </>
              ) : (
                isEdit ? '💾 Cập Nhật' : '➕ Thêm Lịch Trình'
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/schedules')}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition-colors"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScheduleForm;
