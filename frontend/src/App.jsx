// Ứng dụng chính với React Router - định nghĩa tất cả routes
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ScheduleTable from './components/ScheduleTable';
import ScheduleForm from './components/ScheduleForm';
import VehicleManager from './components/VehicleManager';
import UserManager from './components/UserManager';
import CustomerManager from './components/CustomerManager';
import CustomerStats from './components/CustomerStats';
import ReportPage from './components/ReportPage';

/**
 * Layout chính cho các trang được bảo vệ (có Navbar)
 */
function ProtectedLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

/**
 * Redirect từ / đến trang phù hợp với role
 */
function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'customer' ? '/schedules' : '/dashboard'} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Trang đăng nhập - công khai */}
          <Route path="/login" element={<Login />} />

          {/* Chuyển hướng từ / đến trang phù hợp với role */}
          <Route path="/" element={<PrivateRoute><RootRedirect /></PrivateRoute>} />

          {/* Trang tổng quan - không cho customer */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute allowedRoles={['admin', 'accountant', 'fleet_manager', 'driver']}>
                <ProtectedLayout>
                  <Dashboard />
                </ProtectedLayout>
              </PrivateRoute>
            }
          />

          {/* Danh sách lịch trình - tất cả vai trò kể cả customer */}
          <Route
            path="/schedules"
            element={
              <PrivateRoute>
                <ProtectedLayout>
                  <ScheduleTable />
                </ProtectedLayout>
              </PrivateRoute>
            }
          />

          {/* Thêm lịch trình mới */}
          <Route
            path="/schedules/new"
            element={
              <PrivateRoute allowedRoles={['admin', 'fleet_manager', 'driver']}>
                <ProtectedLayout>
                  <ScheduleForm />
                </ProtectedLayout>
              </PrivateRoute>
            }
          />

          {/* Sửa lịch trình */}
          <Route
            path="/schedules/edit/:id"
            element={
              <PrivateRoute allowedRoles={['admin', 'fleet_manager', 'driver']}>
                <ProtectedLayout>
                  <ScheduleForm />
                </ProtectedLayout>
              </PrivateRoute>
            }
          />

          {/* Quản lý phương tiện - admin và fleet_manager */}
          <Route
            path="/vehicles"
            element={
              <PrivateRoute allowedRoles={['admin', 'fleet_manager']}>
                <ProtectedLayout>
                  <VehicleManager />
                </ProtectedLayout>
              </PrivateRoute>
            }
          />

          {/* Quản lý người dùng - chỉ admin */}
          <Route
            path="/users"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <ProtectedLayout>
                  <UserManager />
                </ProtectedLayout>
              </PrivateRoute>
            }
          />

          {/* Quản lý khách hàng - admin và fleet_manager */}
          <Route
            path="/customers"
            element={
              <PrivateRoute allowedRoles={['admin', 'fleet_manager']}>
                <ProtectedLayout>
                  <CustomerManager />
                </ProtectedLayout>
              </PrivateRoute>
            }
          />

          {/* Thống kê theo khách hàng - admin, accountant, fleet_manager */}
          <Route
            path="/customers/stats"
            element={
              <PrivateRoute allowedRoles={['admin', 'accountant', 'fleet_manager']}>
                <ProtectedLayout>
                  <CustomerStats />
                </ProtectedLayout>
              </PrivateRoute>
            }
          />

          {/* Báo cáo - admin, accountant, fleet_manager */}
          <Route
            path="/reports"
            element={
              <PrivateRoute allowedRoles={['admin', 'accountant', 'fleet_manager']}>
                <ProtectedLayout>
                  <ReportPage />
                </ProtectedLayout>
              </PrivateRoute>
            }
          />

          {/* Trang 404 */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center bg-white p-8 rounded-xl shadow">
                  <div className="text-7xl mb-4">🔍</div>
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">404</h1>
                  <p className="text-gray-600 mb-4">Trang không tồn tại</p>
                  <a href="/dashboard" className="text-blue-600 hover:underline">
                    Về trang chủ
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
