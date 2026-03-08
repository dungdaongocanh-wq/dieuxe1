// Component báo cáo tháng - tổng hợp lịch trình theo tháng
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPeriodFromMonth } from '../utils/billing';

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

function MonthlyReport() {
  const { getAuthHeaders } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [summary, setSummary] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [comboMinCheck, setComboMinCheck] = useState([]);

  const [filters, setFilters] = useState({
    month: getCurrentMonth(),
    vehicle_id: '',
    driver_id: '',
    customer_id: ''
  });

  // Tải danh sách bộ lọc (xe, lái xe, khách hàng) khi mount
  useEffect(() => {
    const headers = getAuthHeaders();
    Promise.all([
      fetch('/api/vehicles', { headers }),
      fetch('/api/users', { headers }),
      fetch('/api/customers', { headers })
    ]).then(async ([vRes, uRes, cRes]) => {
      if (vRes.ok) {
        const vData = await vRes.json();
        setVehicles(vData.filter(v => v.is_active));
      }
      if (uRes.ok) {
        const uData = await uRes.json();
        setDrivers(uData.filter(u => u.role === 'driver' && u.is_active));
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setCustomers(cData.filter(c => c.is_active));
      }
    }).catch(console.error);
  }, [getAuthHeaders]);

  // Tải dữ liệu báo cáo khi filters thay đổi
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.month) params.append('month', filters.month);
      if (filters.vehicle_id) params.append('vehicle_id', filters.vehicle_id);
      if (filters.driver_id) params.append('driver_id', filters.driver_id);
      if (filters.customer_id) params.append('customer_id', filters.customer_id);

      const res = await fetch(`/api/schedules/export/monthly?${params}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
        setSummary(data.summary || null);
      }

      // Tải dữ liệu kiểm tra phí tối thiểu combo
      if (filters.month) {
        const { periodStart, periodEnd } = getPeriodFromMonth(filters.month);
        const comboParams = new URLSearchParams({ period_start: periodStart, period_end: periodEnd });
        if (filters.vehicle_id) comboParams.append('vehicle_id', filters.vehicle_id);
        if (filters.customer_id) comboParams.append('customer_id', filters.customer_id);
        const comboRes = await fetch(`/api/schedules/combo-min-check?${comboParams}`, {
          headers: getAuthHeaders()
        });
        if (comboRes.ok) {
          setComboMinCheck(await comboRes.json());
        } else {
          setComboMinCheck([]);
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải báo cáo tháng:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, getAuthHeaders]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  /**
   * Xuất CSV báo cáo tháng
   */
  const handleExportCSV = () => {
    const monthLabel = filters.month || 'all';
    const headers = [
      'STT', 'Người Lái', 'Ngày', 'BKS', 'Loại Xe', 'Khách Hàng',
      'Điểm Đi', 'Điểm Đến', 'Số KM Đi', 'Số KM K.Thúc',
      'Tổng KM', 'Phí Cầu Đường (VNĐ)', 'Thành Tiền Trước Thuế (VNĐ)',
      'Xăng Tiêu Thụ (lít)', 'Ghi Chú', 'Trạng Thái'
    ];

    const rows = schedules.map((s, i) => [
      i + 1,
      s.driver_name,
      fmtDate(s.trip_date),
      s.license_plate,
      s.vehicle_type || '',
      s.customer_short_name || '',
      s.departure_point,
      s.destination_point,
      s.km_start,
      s.km_end,
      s.km_total != null ? s.km_total.toFixed(1) : '',
      s.toll_fee != null ? s.toll_fee.toFixed(0) : '0',
      s.amount_before_tax != null ? s.amount_before_tax.toFixed(0) : '',
      s.fuel_consumed != null ? s.fuel_consumed.toFixed(2) : '',
      s.notes || '',
      s.status === 'approved' ? 'Đã duyệt' : s.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'
    ]);

    // Dòng tổng
    if (summary) {
      rows.push([]);
      rows.push([
        '', '', '', '', '', '', '',
        'TỔNG CỘNG',
        '', '',
        (summary.total_km || 0).toFixed(1),
        (summary.total_toll_fee || 0).toFixed(0),
        (summary.total_amount || 0).toFixed(0),
        (summary.total_fuel_consumed || 0).toFixed(2),
        '', ''
      ]);
    }

    // Section kiểm tra phí tối thiểu combo
    if (comboMinCheck.length > 0) {
      rows.push([]);
      rows.push(['KIỂM TRA PHÍ TỐI THIỂU COMBO', '', '', '', '', '', '', '', '']);
      rows.push(['BKS', 'Khách Hàng', 'Tổng KM Kỳ', 'Phí Thực Tế (VNĐ)', 'Phí Tối Thiểu (VNĐ)', 'Phí Quyết Toán (VNĐ)', 'Chênh Lệch (VNĐ)', '', '']);
      comboMinCheck.forEach(r => {
        rows.push([
          r.license_plate,
          r.customer_short_name || '',
          r.total_km_in_period.toFixed(1),
          r.total_amount_actual.toFixed(0),
          r.min_amount.toFixed(0),
          r.final_amount.toFixed(0),
          r.is_below_minimum ? r.adjustment.toFixed(0) : '0',
          '', ''
        ]);
      });
      const totalFinal = comboMinCheck.reduce((s, r) => s + r.final_amount, 0);
      const totalAdj = comboMinCheck.reduce((s, r) => s + r.adjustment, 0);
      rows.push(['', '', '', '', 'TỔNG', totalFinal.toFixed(0), totalAdj.toFixed(0), '', '']);
    }

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-thang-${monthLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📈 Báo Cáo Tháng</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tổng hợp lịch trình theo tháng</p>
        </div>
        {schedules.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            📥 Xuất CSV
          </button>
        )}
      </div>

      {/* Bộ lọc */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tháng/Năm</label>
            <input
              type="month"
              value={filters.month}
              onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Xe (BKS)</label>
            <select
              value={filters.vehicle_id}
              onChange={e => setFilters(f => ({ ...f, vehicle_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Tất cả xe</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.license_plate} - {v.vehicle_type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lái Xe</label>
            <select
              value={filters.driver_id}
              onChange={e => setFilters(f => ({ ...f, driver_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Tất cả lái xe</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Khách Hàng</label>
            <select
              value={filters.customer_id}
              onChange={e => setFilters(f => ({ ...f, customer_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Tất cả khách hàng</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.short_name} – {c.company_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="loading-spinner mx-auto mb-3"></div>
          <p className="text-gray-500">Đang tải...</p>
        </div>
      ) : (
        <>
          {/* Thẻ tổng hợp */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl shadow p-5 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 font-medium">Tổng Số Chuyến</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{summary.total_trips}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 border-l-4 border-green-500">
                <p className="text-xs text-gray-500 font-medium">Tổng KM</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {(summary.total_km || 0).toFixed(1)}
                </p>
                <p className="text-xs text-gray-400 mt-1">km</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 border-l-4 border-purple-500">
                <p className="text-xs text-gray-500 font-medium">Tổng Phí Cầu Đường</p>
                <p className="text-xl font-bold text-gray-800 mt-1">
                  {new Intl.NumberFormat('vi-VN').format(summary.total_toll_fee || 0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">VNĐ</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 border-l-4 border-yellow-500">
                <p className="text-xs text-gray-500 font-medium">Tổng Doanh Thu</p>
                <p className="text-xl font-bold text-gray-800 mt-1">
                  {new Intl.NumberFormat('vi-VN').format(summary.total_amount || 0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">VNĐ (trước thuế)</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 border-l-4 border-orange-500">
                <p className="text-xs text-gray-500 font-medium">Tổng Xăng</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {(summary.total_fuel_consumed || 0).toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 mt-1">lít</p>
              </div>
            </div>
          )}

          {/* Kiểm tra phí tối thiểu combo */}
          {comboMinCheck.length > 0 && (
            <div className="bg-white rounded-xl shadow">
              <div className="p-5 border-b">
                <h2 className="text-lg font-semibold text-gray-800">⚠️ Kiểm Tra Phí Tối Thiểu Combo</h2>
                {comboMinCheck[0] && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Kỳ: {comboMinCheck[0].period_start} → {comboMinCheck[0].period_end}
                  </p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {['BKS', 'Khách Hàng', 'Tổng KM Kỳ', 'Phí Thực Tế', 'Phí Tối Thiểu', 'Phí Quyết Toán', 'Chênh Lệch'].map(h => (
                        <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {comboMinCheck.map((r, i) => (
                      <tr key={i} className={r.is_below_minimum ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-3 text-sm">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono text-xs">{r.license_plate}</span>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">{r.customer_short_name || '—'}</td>
                        <td className="px-3 py-3 text-sm font-semibold text-blue-700 text-right">{r.total_km_in_period.toFixed(1)} km</td>
                        <td className="px-3 py-3 text-sm text-gray-700 text-right whitespace-nowrap">{fmtCurrency(r.total_amount_actual)}</td>
                        <td className="px-3 py-3 text-sm text-gray-700 text-right whitespace-nowrap">{fmtCurrency(r.min_amount)}</td>
                        <td className={`px-3 py-3 text-sm font-bold text-right whitespace-nowrap ${r.is_below_minimum ? 'text-red-600' : 'text-green-700'}`}>
                          {r.is_below_minimum && '⚠️ '}{fmtCurrency(r.final_amount)}
                        </td>
                        <td className={`px-3 py-3 text-sm font-semibold text-right whitespace-nowrap ${r.is_below_minimum ? 'text-red-600' : 'text-gray-400'}`}>
                          {r.is_below_minimum ? fmtCurrency(r.adjustment) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-sm font-bold text-gray-700 text-right">TỔNG CỘNG:</td>
                      <td className="px-3 py-3 text-sm font-bold text-green-800 text-right whitespace-nowrap">
                        {fmtCurrency(comboMinCheck.reduce((s, r) => s + r.final_amount, 0))}
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-red-700 text-right whitespace-nowrap">
                        {comboMinCheck.some(r => r.is_below_minimum)
                          ? fmtCurrency(comboMinCheck.reduce((s, r) => s + r.adjustment, 0))
                          : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Bảng chi tiết */}
          <div className="bg-white rounded-xl shadow">
            <div className="p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-800">📋 Danh Sách Chuyến Đi</h2>
            </div>
            {schedules.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-5xl mb-3">📭</div>
                <p>Không có dữ liệu trong kỳ này</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        'STT', 'Người Lái', 'Ngày', 'BKS', 'Khách Hàng',
                        'Điểm Đi', 'Điểm Đến', 'Tổng KM',
                        'Phí Cầu Đường', 'Thành Tiền', 'Xăng', 'Trạng Thái'
                      ].map(h => (
                        <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {schedules.map((s, i) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm text-gray-500">{i + 1}</td>
                        <td className="px-3 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{s.driver_name}</td>
                        <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtDate(s.trip_date)}</td>
                        <td className="px-3 py-3 text-sm">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono text-xs">
                            {s.license_plate}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {s.customer_short_name || '—'}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600 max-w-[100px] truncate">{s.departure_point}</td>
                        <td className="px-3 py-3 text-sm text-gray-600 max-w-[100px] truncate">{s.destination_point}</td>
                        <td className="px-3 py-3 text-sm font-semibold text-blue-700 text-right">
                          {s.km_total != null ? s.km_total.toFixed(1) : '—'}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-purple-700 text-right whitespace-nowrap">
                          {s.toll_fee != null
                            ? new Intl.NumberFormat('vi-VN').format(s.toll_fee) + ' VNĐ'
                            : '0 VNĐ'}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-green-700 text-right whitespace-nowrap">
                          {s.amount_before_tax != null
                            ? new Intl.NumberFormat('vi-VN').format(s.amount_before_tax) + ' VNĐ'
                            : '—'}
                        </td>
                        <td className="px-3 py-3 text-sm text-orange-700 text-right whitespace-nowrap">
                          {s.fuel_consumed != null ? s.fuel_consumed.toFixed(2) + ' lít' : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                            s.status === 'approved' ? 'bg-green-100 text-green-800' :
                            s.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {s.status === 'approved' ? 'Đã duyệt' : s.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {summary && (
                    <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                      <tr>
                        <td colSpan={7} className="px-3 py-3 text-sm font-bold text-gray-700 text-right">
                          TỔNG CỘNG:
                        </td>
                        <td className="px-3 py-3 text-sm font-bold text-blue-800 text-right">
                          {(summary.total_km || 0).toFixed(1)}
                        </td>
                        <td className="px-3 py-3 text-sm font-bold text-purple-800 text-right whitespace-nowrap">
                          {new Intl.NumberFormat('vi-VN').format(summary.total_toll_fee || 0)} VNĐ
                        </td>
                        <td className="px-3 py-3 text-sm font-bold text-green-800 text-right whitespace-nowrap">
                          {new Intl.NumberFormat('vi-VN').format(summary.total_amount || 0)} VNĐ
                        </td>
                        <td className="px-3 py-3 text-sm font-bold text-orange-800 text-right whitespace-nowrap">
                          {(summary.total_fuel_consumed || 0).toFixed(2)} lít
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default MonthlyReport;
