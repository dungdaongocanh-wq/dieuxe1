// Component thống kê theo khách hàng
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const fmtVND = new Intl.NumberFormat('vi-VN');

function CustomerStats() {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // Bộ lọc
  const [filters, setFilters] = useState({
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    vehicle_id: '',
    driver_id: ''
  });

  useEffect(() => {
    fetchFilterData();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [filters]);

  const fetchFilterData = async () => {
    try {
      const headers = getAuthHeaders();
      const [vRes, uRes] = await Promise.all([
        apiFetch('/api/vehicles', { headers }),
        apiFetch('/api/users', { headers })
      ]);
      if (vRes.ok) {
        const vData = await vRes.json();
        setVehicles(vData.filter(v => v.is_active));
      }
      if (uRes.ok) {
        const uData = await uRes.json();
        setDrivers(uData.filter(u => u.role === 'driver' && u.is_active));
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu bộ lọc:', err);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.month) params.append('month', filters.month);
      if (filters.vehicle_id) params.append('vehicle_id', filters.vehicle_id);
      if (filters.driver_id) params.append('driver_id', filters.driver_id);

      const res = await apiFetch(`/api/schedules/stats/by-customer?${params}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (err) {
      console.error('Lỗi khi tải thống kê:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmtNumber = (val) => fmtVND.format(Math.round(val || 0));
  const fmtDecimal = (val) => (parseFloat(val) || 0).toFixed(2);

  // Tổng cộng
  const totals = stats.reduce((acc, row) => ({
    total_trips: acc.total_trips + (row.total_trips || 0),
    total_km: acc.total_km + (parseFloat(row.total_km) || 0),
    total_toll_fee: acc.total_toll_fee + (parseFloat(row.total_toll_fee) || 0),
    total_fuel_consumed: acc.total_fuel_consumed + (parseFloat(row.total_fuel_consumed) || 0)
  }), { total_trips: 0, total_km: 0, total_toll_fee: 0, total_fuel_consumed: 0 });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📊 Thống Kê Theo Khách Hàng</h1>
      </div>

      {/* Bộ lọc */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tháng</label>
            <input
              type="month"
              value={filters.month}
              onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Xe</label>
            <select
              value={filters.vehicle_id}
              onChange={e => setFilters(f => ({ ...f, vehicle_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">-- Tất cả xe --</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.license_plate} - {v.vehicle_type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lái Xe</label>
            <select
              value={filters.driver_id}
              onChange={e => setFilters(f => ({ ...f, driver_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">-- Tất cả lái xe --</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bảng thống kê */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto mb-3"></div>
            <p className="text-gray-500">Đang tải...</p>
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p>Không có dữ liệu cho bộ lọc này</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['STT', 'Khách Hàng', 'Số Chuyến', 'Tổng KM', 'Tiền Vé Cầu Đường', 'Xăng Dầu (lít)'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.map((row, index) => (
                  <tr key={row.customer_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-blue-700">{row.customer_short_name}</div>
                      <div className="text-xs text-gray-500">{row.customer_company_name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 font-medium">{row.total_trips}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{fmtDecimal(row.total_km)} km</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{fmtNumber(row.total_toll_fee)} VNĐ</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{fmtDecimal(row.total_fuel_consumed)} lít</td>
                  </tr>
                ))}
                {/* Hàng tổng cộng */}
                <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                  <td className="px-4 py-3 text-sm text-gray-700" colSpan={2}>Tổng Cộng</td>
                  <td className="px-4 py-3 text-sm text-blue-800">{totals.total_trips}</td>
                  <td className="px-4 py-3 text-sm text-blue-800">{fmtDecimal(totals.total_km)} km</td>
                  <td className="px-4 py-3 text-sm text-blue-800">{fmtNumber(totals.total_toll_fee)} VNĐ</td>
                  <td className="px-4 py-3 text-sm text-blue-800">{fmtDecimal(totals.total_fuel_consumed)} lít</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerStats;
