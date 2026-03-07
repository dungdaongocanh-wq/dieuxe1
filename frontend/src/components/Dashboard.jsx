// Component trang tổng quan - hiển thị thống kê và lịch trình gần đây
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Card thống kê
function StatCard({ icon, title, value, color, subtitle }) {
  return (
    <div className={`bg-white rounded-xl shadow p-6 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}

// Nhãn trạng thái
const statusConfig = {
  pending: { label: 'Chờ duyệt', class: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Đã duyệt', class: 'bg-green-100 text-green-800' },
  rejected: { label: 'Từ chối', class: 'bg-red-100 text-red-800' }
};

function Dashboard() {
  const { getAuthHeaders, user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lấy ngày hôm nay theo định dạng YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchData();
  }, []);

  /**
   * Tải dữ liệu lịch trình và phương tiện
   */
  const fetchData = async () => {
    try {
      const [schedulesRes, vehiclesRes] = await Promise.all([
        fetch('/api/schedules', { headers: getAuthHeaders() }),
        fetch('/api/vehicles', { headers: getAuthHeaders() })
      ]);

      if (schedulesRes.ok) setSchedules(await schedulesRes.json());
      if (vehiclesRes.ok) setVehicles(await vehiclesRes.json());
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Tính toán thống kê
  const todaySchedules = schedules.filter(s => s.trip_date === today);
  const todayKm = todaySchedules.reduce((sum, s) => sum + (s.km_total || 0), 0);
  const activeVehicles = vehicles.filter(v => v.is_active).length;
  const pendingCount = schedules.filter(s => s.status === 'pending').length;

  // Lấy 5 lịch trình gần nhất
  const recentSchedules = schedules.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-3"></div>
          <p className="text-gray-500">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tiêu đề */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tổng Quan</h1>
          <p className="text-gray-500 text-sm">
            Xin chào, {user?.full_name}! Hôm nay là {new Date().toLocaleDateString('vi-VN', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
        {['admin', 'fleet_manager', 'driver'].includes(user?.role) && (
          <Link
            to="/schedules/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Thêm Lịch Trình
          </Link>
        )}
      </div>

      {/* Thống kê */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="📋"
          title="Chuyến đi hôm nay"
          value={todaySchedules.length}
          color="border-blue-500"
          subtitle="chuyến"
        />
        <StatCard
          icon="🛣️"
          title="Tổng Km hôm nay"
          value={todayKm.toFixed(1)}
          color="border-green-500"
          subtitle="km"
        />
        <StatCard
          icon="🚗"
          title="Phương tiện hoạt động"
          value={activeVehicles}
          color="border-yellow-500"
          subtitle={`/ ${vehicles.length} tổng`}
        />
        <StatCard
          icon="⏳"
          title="Chờ phê duyệt"
          value={pendingCount}
          color="border-red-500"
          subtitle="lịch trình"
        />
      </div>

      {/* Lịch trình gần đây */}
      <div className="bg-white rounded-xl shadow">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Lịch Trình Gần Đây</h2>
          <Link to="/schedules" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Xem tất cả →
          </Link>
        </div>

        {recentSchedules.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p>Chưa có lịch trình nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ngày</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Lái xe</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Biển số</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Điểm đi → Đến</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Tổng Km</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentSchedules.map(schedule => (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(schedule.trip_date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {schedule.driver_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {schedule.license_plate}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {schedule.departure_point} → {schedule.destination_point}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-800">
                      {schedule.km_total?.toFixed(1)} km
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusConfig[schedule.status]?.class}`}>
                        {statusConfig[schedule.status]?.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
