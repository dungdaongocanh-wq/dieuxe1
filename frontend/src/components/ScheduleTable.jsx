// Component bảng danh sách lịch trình với bộ lọc và phân trang
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Cấu hình màu sắc cho từng trạng thái
const statusConfig = {
  pending: { label: 'Chờ duyệt', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  approved: { label: 'Đã duyệt', class: 'bg-green-100 text-green-800 border-green-200' },
  rejected: { label: 'Từ chối', class: 'bg-red-100 text-red-800 border-red-200' }
};

// Số bản ghi mỗi trang
const PAGE_SIZE = 10;

// Lấy tháng hiện tại dạng YYYY-MM
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

// Format tiền VND
const fmtCurrency = (val) => {
  if (val == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(val) + ' VNĐ';
};

// Format ngày DD/MM/YYYY
const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('vi-VN');
};

function ScheduleTable() {
  const { getAuthHeaders, user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Bộ lọc
  const [filters, setFilters] = useState({
    month: getCurrentMonth(),
    driver_id: '',
    vehicle_id: '',
    status: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.month) params.append('month', filters.month);
      if (filters.driver_id) params.append('driver_id', filters.driver_id);
      if (filters.vehicle_id) params.append('vehicle_id', filters.vehicle_id);
      if (filters.status) params.append('status', filters.status);

      const res = await fetch(`/api/schedules?${params}`, { headers: getAuthHeaders() });
      if (res.ok) setSchedules(await res.json());
    } catch (err) {
      console.error('Lỗi khi tải lịch trình:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, getAuthHeaders]);

  useEffect(() => {
    fetchSchedules();
    setCurrentPage(1);
  }, [fetchSchedules]);

  /**
   * Tải danh sách phương tiện và lái xe ban đầu
   */
  const fetchInitialData = async () => {
    try {
      const headers = getAuthHeaders();
      const [vehiclesRes] = await Promise.all([
        fetch('/api/vehicles', { headers })
      ]);
      if (vehiclesRes.ok) setVehicles(await vehiclesRes.json());

      if (['admin', 'fleet_manager', 'accountant'].includes(user?.role)) {
        const usersRes = await fetch('/api/users', { headers });
        if (usersRes.ok) {
          const users = await usersRes.json();
          setDrivers(users.filter(u => u.role === 'driver'));
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu ban đầu:', err);
    }
  };

  /**
   * Xóa lịch trình
   */
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setSchedules(prev => prev.filter(s => s.id !== id));
        setConfirmDelete(null);
      }
    } catch (err) {
      console.error('Lỗi khi xóa:', err);
    }
  };

  /**
   * Thay đổi trạng thái lịch trình (duyệt/từ chối)
   */
  const handleStatusChange = async (id, status) => {
    try {
      const res = await fetch(`/api/schedules/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const updated = await res.json();
        setSchedules(prev => prev.map(s => s.id === id ? updated : s));
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật trạng thái:', err);
    }
  };

  /**
   * Xuất CSV
   */
  const handleExportCSV = () => {
    const headers = ['STT', 'Người Lái', 'Ngày', 'Điểm Đi', 'Điểm Đến', 'Số KM Đi', 'Số KM Kết Thúc', 'Tổng KM', 'Thành Tiền Trước Thuế (VNĐ)', 'BKS', 'Ghi Chú', 'Xăng Tiêu Thụ (lít)', 'Trạng Thái'];
    const rows = schedules.map((s, i) => [
      i + 1,
      s.driver_name,
      fmtDate(s.trip_date),
      s.departure_point,
      s.destination_point,
      s.km_start,
      s.km_end,
      s.km_total != null ? s.km_total.toFixed(1) : '',
      s.amount_before_tax != null ? s.amount_before_tax.toFixed(0) : '',
      s.license_plate,
      s.notes || '',
      s.fuel_consumed != null ? s.fuel_consumed.toFixed(2) : '',
      statusConfig[s.status]?.label || s.status
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const bom = '\uFEFF'; // BOM for Excel UTF-8
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lich-trinh-${filters.month || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Phân trang
  const totalPages = Math.ceil(schedules.length / PAGE_SIZE);
  const paginatedSchedules = schedules.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  /**
   * Reset bộ lọc
   */
  const resetFilters = () => {
    setFilters({ month: getCurrentMonth(), driver_id: '', vehicle_id: '', status: '' });
  };

  const canApprove = ['admin', 'fleet_manager', 'accountant'].includes(user?.role);
  const canDelete = ['admin', 'fleet_manager'].includes(user?.role);

  // Tổng hợp
  const totalKm = schedules.reduce((sum, s) => sum + (s.km_total || 0), 0);
  const totalAmount = schedules.reduce((sum, s) => sum + (s.amount_before_tax || 0), 0);
  const totalFuel = schedules.reduce((sum, s) => sum + (s.fuel_consumed || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">BẢNG THEO DÕI TÌNH HÌNH SỬ DỤNG XE</h1>
          <p className="text-sm text-gray-500 mt-0.5">CÔNG TY TNHH DNA EXPRESS VIỆT NAM</p>
        </div>
        <div className="flex gap-2">
          {['admin', 'fleet_manager', 'accountant'].includes(user?.role) && schedules.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              📥 Xuất Excel (CSV)
            </button>
          )}
          {['admin', 'fleet_manager', 'driver'].includes(user?.role) && (
            <Link
              to="/schedules/new"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              + Thêm Lịch Trình
            </Link>
          )}
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tháng/Năm</label>
            <input
              type="month"
              value={filters.month}
              onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {['admin', 'fleet_manager', 'accountant'].includes(user?.role) && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lái Xe</label>
              <select
                value={filters.driver_id}
                onChange={e => setFilters(f => ({ ...f, driver_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Tất cả</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">BKS Xe</label>
            <select
              value={filters.vehicle_id}
              onChange={e => setFilters(f => ({ ...f, vehicle_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Tất cả</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.license_plate}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Trạng Thái</label>
            <select
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Tất cả</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="w-full px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm transition-colors"
            >
              🔄 Xóa bộ lọc
            </button>
          </div>
        </div>
      </div>

      {/* Tổng hợp */}
      {schedules.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-center">
            <p className="text-xs text-blue-600 font-medium">Tổng KM</p>
            <p className="text-lg font-bold text-blue-800">{totalKm.toFixed(1)} km</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 border border-green-100 text-center">
            <p className="text-xs text-green-600 font-medium">Tổng Thành Tiền</p>
            <p className="text-lg font-bold text-green-800">{new Intl.NumberFormat('vi-VN').format(totalAmount)} VNĐ</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 text-center">
            <p className="text-xs text-orange-600 font-medium">Tổng Xăng</p>
            <p className="text-lg font-bold text-orange-800">{totalFuel.toFixed(2)} lít</p>
          </div>
        </div>
      )}

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto mb-3"></div>
            <p className="text-gray-500">Đang tải...</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p>Không có lịch trình nào</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-blue-700 text-white">
                  <tr>
                    {['STT', 'Người Lái', 'Ngày', 'Điểm Đi', 'Điểm Đến',
                      'Số KM Đi', 'Số KM K.Thúc', 'Tổng KM', 'Thành Tiền Trước Thuế',
                      'BKS', 'Ghi Chú', 'Xăng Tiêu Thụ', 'Trạng Thái', 'Thao Tác'
                    ].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedSchedules.map((schedule, index) => (
                    <tr key={schedule.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-sm text-gray-500">
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">
                        {schedule.driver_name}
                      </td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">
                        {fmtDate(schedule.trip_date)}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 max-w-[100px] truncate">
                        {schedule.departure_point}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 max-w-[100px] truncate">
                        {schedule.destination_point}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-gray-600">
                        {schedule.km_start?.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-gray-600">
                        {schedule.km_end?.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-3 py-3 text-sm text-right font-semibold text-blue-700">
                        {schedule.km_total != null ? schedule.km_total.toFixed(1) : '—'}
                      </td>
                      <td className="px-3 py-3 text-sm text-right font-semibold text-green-700 whitespace-nowrap">
                        {schedule.amount_before_tax != null
                          ? new Intl.NumberFormat('vi-VN').format(schedule.amount_before_tax) + ' VNĐ'
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono text-xs">
                          {schedule.license_plate}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 max-w-[80px] truncate">
                        {schedule.notes || '—'}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-orange-700 whitespace-nowrap">
                        {schedule.fuel_consumed != null ? schedule.fuel_consumed.toFixed(2) + ' lít' : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${statusConfig[schedule.status]?.class}`}>
                          {statusConfig[schedule.status]?.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {/* Nút sửa - driver chỉ sửa được lịch pending của mình */}
                          {(user?.role !== 'driver' ||
                            (schedule.driver_id === user?.id && schedule.status === 'pending')) && (
                            <Link
                              to={`/schedules/edit/${schedule.id}`}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors text-xs font-medium"
                              title="Sửa"
                            >
                              ✏️
                            </Link>
                          )}

                          {/* Nút duyệt */}
                          {canApprove && schedule.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(schedule.id, 'approved')}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors text-xs"
                                title="Duyệt"
                              >
                                ✅
                              </button>
                              <button
                                onClick={() => handleStatusChange(schedule.id, 'rejected')}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors text-xs"
                                title="Từ chối"
                              >
                                ❌
                              </button>
                            </>
                          )}

                          {/* Nút xóa */}
                          {canDelete && (
                            <button
                              onClick={() => setConfirmDelete(schedule.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors text-xs"
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

            {/* Phân trang */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <p className="text-sm text-gray-600">
                  Hiển thị {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, schedules.length)} / {schedules.length} bản ghi
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-100 transition-colors"
                  >
                    ‹ Trước
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                    return page <= totalPages ? (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-sm border rounded-md transition-colors ${
                          currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    ) : null;
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-100 transition-colors"
                  >
                    Sau ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Hộp thoại xác nhận xóa */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-lg font-semibold text-gray-800">Xác Nhận Xóa</h3>
              <p className="text-gray-600 text-sm mt-1">Bạn có chắc muốn xóa lịch trình này? Thao tác này không thể hoàn tác.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Xóa
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 rounded-lg font-medium transition-colors"
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

export default ScheduleTable;
