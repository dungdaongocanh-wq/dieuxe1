// Component quản lý nạp nhiên liệu
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// Format tiền VNĐ
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

// Lấy tháng hiện tại dạng YYYY-MM
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

// Lấy ngày hôm nay dạng YYYY-MM-DD
const getToday = () => new Date().toISOString().slice(0, 10);

// Số bản ghi mỗi trang
const PAGE_SIZE = 10;

/**
 * Component quản lý nạp nhiên liệu
 */
function FuelManager() {
  const { getAuthHeaders, user } = useAuth();

  // Dữ liệu
  const [logs, setLogs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Bộ lọc
  const [filters, setFilters] = useState({
    month: getCurrentMonth(),
    vehicle_id: '',
    driver_id: ''
  });

  // Phân trang
  const [page, setPage] = useState(1);

  // Modal thêm/sửa
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [formData, setFormData] = useState({
    driver_id: '',
    vehicle_id: '',
    refuel_date: getToday(),
    liters: '',
    unit_price: '',
    notes: '',
    attachment_base64: '',
    attachment_name: '',
    attachment_type: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canEdit = ['admin', 'fleet_manager', 'driver'].includes(user?.role);
  const canDelete = ['admin', 'fleet_manager'].includes(user?.role);
  const isDriver = user?.role === 'driver';
  const isAdminOrManager = ['admin', 'fleet_manager'].includes(user?.role);

  /**
   * Tải danh sách nhật ký nhiên liệu
   */
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.month) params.append('month', filters.month);
      if (filters.vehicle_id) params.append('vehicle_id', filters.vehicle_id);
      if (filters.driver_id) params.append('driver_id', filters.driver_id);

      const res = await fetch(`/api/fuel-logs?${params}`, { headers: getAuthHeaders() });
      if (res.ok) {
        setLogs(await res.json());
        setPage(1);
      } else {
        const data = await res.json();
        setError(data.message || 'Không thể tải dữ liệu');
      }
    } catch (err) {
      setError('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  }, [filters, getAuthHeaders]);

  // Tải xe và lái xe khi mount
  useEffect(() => {
    const headers = getAuthHeaders();
    const fetchVehicles = fetch('/api/vehicles', { headers }).then(r => r.ok ? r.json() : []);
    const fetchUsers = isAdminOrManager
      ? fetch('/api/users', { headers }).then(r => r.ok ? r.json() : [])
      : Promise.resolve([]);

    Promise.all([fetchVehicles, fetchUsers]).then(([v, u]) => {
      setVehicles(v.filter(x => x.is_active));
      setDrivers(u.filter(x => x.role === 'driver'));
    }).catch(console.error);
  }, [getAuthHeaders, isAdminOrManager]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  /**
   * Mở modal thêm mới
   */
  const handleAdd = () => {
    setEditingLog(null);
    setFormData({
      driver_id: isDriver ? user.id : '',
      vehicle_id: '',
      refuel_date: getToday(),
      liters: '',
      unit_price: '',
      notes: '',
      attachment_base64: '',
      attachment_name: '',
      attachment_type: ''
    });
    setFormError('');
    setShowModal(true);
  };

  /**
   * Mở modal chỉnh sửa
   * @param {Object} log - Bản ghi cần chỉnh sửa
   */
  const handleEdit = (log) => {
    setEditingLog(log);
    setFormData({
      driver_id: log.driver_id,
      vehicle_id: log.vehicle_id,
      refuel_date: log.refuel_date,
      liters: log.liters,
      unit_price: log.unit_price,
      notes: log.notes || '',
      attachment_base64: '',
      attachment_name: '',
      attachment_type: ''
    });
    setFormError('');
    setShowModal(true);
  };

  /**
   * Xử lý chọn file đính kèm, convert sang base64
   * @param {Event} e - Sự kiện input file
   */
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('File đính kèm không được quá 5MB');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      // Lấy phần base64 sau dấu phẩy
      const base64 = ev.target.result.split(',')[1];
      setFormData(prev => ({
        ...prev,
        attachment_base64: base64,
        attachment_name: file.name,
        attachment_type: file.type
      }));
    };
    reader.readAsDataURL(file);
  };

  /**
   * Gửi form thêm/sửa
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.vehicle_id || !formData.refuel_date || !formData.liters || !formData.unit_price) {
      setFormError('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    if (parseFloat(formData.liters) <= 0) {
      setFormError('Số lít phải lớn hơn 0');
      return;
    }
    if (parseFloat(formData.unit_price) <= 0) {
      setFormError('Đơn giá phải lớn hơn 0');
      return;
    }

    setSubmitting(true);
    try {
      const body = { ...formData };
      if (!body.attachment_base64) {
        delete body.attachment_base64;
        delete body.attachment_name;
        delete body.attachment_type;
      }

      const url = editingLog ? `/api/fuel-logs/${editingLog.id}` : '/api/fuel-logs';
      const method = editingLog ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setShowModal(false);
        fetchLogs();
      } else {
        const data = await res.json();
        setFormError(data.message || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setFormError('Lỗi kết nối server');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Xóa bản ghi nhiên liệu
   * @param {number} id - ID bản ghi cần xóa
   */
  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa bản ghi này?')) return;
    try {
      const res = await fetch(`/api/fuel-logs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchLogs();
      } else {
        const data = await res.json();
        alert(data.message || 'Không thể xóa');
      }
    } catch (err) {
      alert('Lỗi kết nối server');
    }
  };

  /**
   * Xem file đính kèm - tải về qua fetch với auth header rồi mở blob URL
   * @param {number} id - ID bản ghi
   * @param {string} mimeType - MIME type của file
   */
  const handleViewAttachment = async (id, mimeType) => {
    try {
      const res = await fetch(`/api/fuel-logs/${id}/attachment`, { headers: getAuthHeaders() });
      if (!res.ok) {
        alert('Không thể tải file đính kèm');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Giải phóng URL sau 60 giây
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      alert('Lỗi kết nối server');
    }
  };

  /**
   * Xuất CSV danh sách nhiên liệu
   */
  const handleExportCSV = () => {
    const monthLabel = filters.month || 'all';
    const headers = ['STT', 'Lái Xe', 'Ngày', 'Biển Số Xe', 'Số Lít', 'Đơn Giá (VNĐ/lít)', 'Thành Tiền (VNĐ)', 'Ghi Chú'];

    const rows = logs.map((log, i) => [
      i + 1,
      log.driver_name,
      fmtDate(log.refuel_date),
      log.license_plate,
      log.liters,
      log.unit_price,
      log.total_cost,
      log.notes || ''
    ]);

    const totalCost = logs.reduce((sum, l) => sum + (l.total_cost || 0), 0);
    const totalLiters = logs.reduce((sum, l) => sum + (l.liters || 0), 0);
    rows.push([]);
    rows.push(['', '', '', 'TỔNG CỘNG', totalLiters.toFixed(2), '', totalCost.toFixed(0), '']);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nhien-lieu-${monthLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const pagedLogs = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Tính thành tiền trong form
  const calculatedTotal = formData.liters && formData.unit_price
    ? parseFloat(formData.liters) * parseFloat(formData.unit_price)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">⛽ Quản Lý Nạp Nhiên Liệu</h1>
          <p className="text-sm text-gray-500 mt-0.5">CÔNG TY TNHH DNA EXPRESS VIỆT NAM</p>
        </div>
        <div className="flex gap-2">
          {logs.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              📥 Xuất CSV
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              ➕ Thêm Mới
            </button>
          )}
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tháng</label>
            <input
              type="month"
              value={filters.month}
              onChange={e => setFilters(prev => ({ ...prev, month: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Xe</label>
            <select
              value={filters.vehicle_id}
              onChange={e => setFilters(prev => ({ ...prev, vehicle_id: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Tất cả xe —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.license_plate}</option>
              ))}
            </select>
          </div>
          {isAdminOrManager && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lái Xe</label>
              <select
                value={filters.driver_id}
                onChange={e => setFilters(prev => ({ ...prev, driver_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Tất cả lái xe —</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Thông báo lỗi */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-500">Đang tải...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">⛽</div>
            <p>Không có dữ liệu nhiên liệu</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">STT</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Lái Xe</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Ngày</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">BKS</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Số Lít</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Đơn Giá</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Thành Tiền</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">File</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Ghi Chú</th>
                    {canEdit && (
                      <th className="px-4 py-3 text-center font-medium text-gray-600">Thao Tác</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pagedLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{log.driver_name}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(log.refuel_date)}</td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium">
                          {log.license_plate}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800">
                        {log.liters != null ? log.liters.toFixed(2) : '—'} lít
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {fmtCurrency(log.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">
                        {fmtCurrency(log.total_cost)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.has_attachment ? (
                          <button
                            onClick={() => handleViewAttachment(log.id, log.attachment_type)}
                            className="text-blue-600 hover:text-blue-800 text-xs underline"
                            title={log.attachment_name || 'Xem file'}
                          >
                            📎 Xem
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{log.notes || '—'}</td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {(isAdminOrManager || (isDriver && log.driver_id === user.id)) && (
                              <button
                                onClick={() => handleEdit(log)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                              >
                                ✏️ Sửa
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(log.id)}
                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                              >
                                🗑️ Xóa
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phân trang */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <span className="text-sm text-gray-500">
                  Trang {page}/{totalPages} · {logs.length} bản ghi
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-40"
                  >
                    ◀
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .reduce((acc, p, i, arr) => {
                      if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === '...'
                        ? <span key={`ellipsis-${i}`} className="px-2 py-1 text-sm text-gray-400">…</span>
                        : (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`px-3 py-1 text-sm border rounded ${
                              p === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-100'
                            }`}
                          >
                            {p}
                          </button>
                        )
                    )}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-40"
                  >
                    ▶
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal thêm/sửa */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingLog ? '✏️ Sửa Bản Ghi Nhiên Liệu' : '➕ Thêm Bản Ghi Nhiên Liệu'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Lái xe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lái Xe <span className="text-red-500">*</span>
                </label>
                {isDriver ? (
                  <input
                    type="text"
                    value={user.full_name}
                    readOnly
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
                  />
                ) : (
                  <select
                    value={formData.driver_id}
                    onChange={e => setFormData(prev => ({ ...prev, driver_id: e.target.value }))}
                    required
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Chọn lái xe —</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Biển số xe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Biển Số Xe <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.vehicle_id}
                  onChange={e => setFormData(prev => ({ ...prev, vehicle_id: e.target.value }))}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Chọn xe —</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.license_plate} {v.vehicle_type ? `(${v.vehicle_type})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Ngày đổ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày Đổ <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.refuel_date}
                  onChange={e => setFormData(prev => ({ ...prev, refuel_date: e.target.value }))}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Số lít và đơn giá */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số Lít <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.liters}
                    onChange={e => setFormData(prev => ({ ...prev, liters: e.target.value }))}
                    required
                    placeholder="0.0"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Đơn Giá (VNĐ/lít) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={formData.unit_price}
                    onChange={e => setFormData(prev => ({ ...prev, unit_price: e.target.value }))}
                    required
                    placeholder="0"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Thành tiền (readonly) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thành Tiền</label>
                <input
                  type="text"
                  value={calculatedTotal > 0 ? fmtCurrency(calculatedTotal) : '—'}
                  readOnly
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-green-50 text-green-800 font-semibold"
                />
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi Chú</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Ghi chú thêm..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* File đính kèm */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Đính Kèm
                  <span className="text-gray-400 font-normal ml-1">(ảnh, PDF, tối đa 5MB)</span>
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {editingLog?.has_attachment && !formData.attachment_base64 && (
                  <p className="text-xs text-green-600 mt-1">✅ Đã có file đính kèm. Upload mới để thay thế.</p>
                )}
                {formData.attachment_name && (
                  <p className="text-xs text-blue-600 mt-1">📎 {formData.attachment_name}</p>
                )}
              </div>

              {/* Thông báo lỗi */}
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              {/* Nút hành động */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? 'Đang lưu...' : (editingLog ? '💾 Cập Nhật' : '➕ Thêm Mới')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 border hover:bg-gray-50 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FuelManager;
