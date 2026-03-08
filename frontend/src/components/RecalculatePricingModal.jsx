// Modal cho admin tính lại giá các chuyến trong khoảng thời gian
import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

// Format tiền VND không có hậu tố
const fmtAmount = (val) => {
  if (val == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(val);
};

// Format ngày DD/MM/YYYY
const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('vi-VN');
};

// Ngày đầu tháng trước dạng YYYY-MM-DD
const getFirstDayOfLastMonth = () => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.toISOString().split('T')[0];
};

// Ngày hôm nay dạng YYYY-MM-DD
const getToday = () => new Date().toISOString().split('T')[0];

function RecalculatePricingModal({ getAuthHeaders, onClose, onSuccess, defaultDateFrom, defaultDateTo }) {
  const [dateFrom, setDateFrom] = useState(defaultDateFrom || getFirstDayOfLastMonth());
  const [dateTo, setDateTo] = useState(defaultDateTo || getToday());
  const [vehicleId, setVehicleId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  // Tải danh sách xe và khách hàng
  useEffect(() => {
    const headers = getAuthHeaders();
    Promise.all([
      apiFetch('/api/vehicles', { headers }),
      apiFetch('/api/customers', { headers })
    ]).then(async ([vRes, cRes]) => {
      if (vRes.ok) {
        const vData = await vRes.json();
        setVehicles(vData.filter(v => v.is_active));
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setCustomers(cData.filter(c => c.is_active));
      }
    }).catch(console.error);
  }, [getAuthHeaders]);

  const callApi = async (dryRun) => {
    setError('');
    if (!dateFrom || !dateTo) {
      setError('Vui lòng nhập đầy đủ ngày bắt đầu và ngày kết thúc');
      return;
    }
    setLoading(true);
    try {
      const body = { date_from: dateFrom, date_to: dateTo, dry_run: dryRun };
      if (vehicleId) body.vehicle_id = parseInt(vehicleId);
      if (customerId) body.customer_id = parseInt(customerId);

      const res = await apiFetch('/api/schedules/recalculate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Lỗi khi tính lại giá');
        return;
      }
      if (dryRun) {
        setPreviewResults(data);
      } else {
        const count = data.updated_count;
        setSuccessMsg(`✅ Đã tính lại giá thành công cho ${count} chuyến`);
        setTimeout(() => {
          onSuccess && onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError('Lỗi kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  const changedResults = previewResults ? previewResults.results.filter(r => r.changed) : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">🔄 Tính Lại Giá Chuyến Đi</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Form bộ lọc */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Từ ngày <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPreviewResults(null); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Đến ngày <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPreviewResults(null); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Xe (BKS) — tùy chọn</label>
              <select
                value={vehicleId}
                onChange={e => { setVehicleId(e.target.value); setPreviewResults(null); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Tất cả xe</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.license_plate}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Khách hàng — tùy chọn</label>
              <select
                value={customerId}
                onChange={e => { setCustomerId(e.target.value); setPreviewResults(null); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Tất cả khách hàng</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.short_name}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}

          {successMsg && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-3 text-sm text-green-700">{successMsg}</div>
          )}

          {/* Bảng preview */}
          {previewResults && (
            <div>
              {changedResults.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">Không có chuyến nào thay đổi giá trong khoảng thời gian này.</div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-2">
                    Tìm thấy <strong>{changedResults.length}</strong> chuyến có thay đổi giá (trong tổng số {previewResults.results.length} chuyến):
                  </p>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full min-w-[600px] text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {['STT', 'BKS', 'Ngày', 'Lái Xe', 'Giá cũ (VNĐ)', 'Giá mới (VNĐ)', 'Thay đổi'].map(h => (
                            <th key={h} className="text-left px-3 py-2 font-medium text-gray-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {changedResults.map((r, idx) => {
                          const diff = r.new_amount - (r.old_amount || 0);
                          const isIncrease = diff > 0;
                          return (
                            <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium">{r.license_plate}</td>
                              <td className="px-3 py-2">{fmtDate(r.trip_date)}</td>
                              <td className="px-3 py-2">{r.driver_name}</td>
                              <td className="px-3 py-2 text-gray-600">{fmtAmount(r.old_amount)}</td>
                              <td className={`px-3 py-2 font-medium ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                                {fmtAmount(r.new_amount)}
                              </td>
                              <td className={`px-3 py-2 font-medium ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                                {isIncrease ? '+' : ''}{fmtAmount(diff)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between p-5 border-t border-gray-200 gap-3 flex-wrap">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
          >
            Đóng
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => callApi(true)}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Đang xử lý...' : '🔍 Xem trước'}
            </button>
            {previewResults && changedResults.length > 0 && !successMsg && (
              <button
                onClick={() => callApi(false)}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Đang xử lý...' : `✅ Xác nhận tính lại ${changedResults.length} chuyến`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecalculatePricingModal;
