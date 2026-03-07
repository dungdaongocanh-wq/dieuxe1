// Ứng dụng chính với React Router - định nghĩa tất cả routes
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ScheduleTable from './components/ScheduleTable';
import ScheduleForm from './components/ScheduleForm';
import VehicleManager from './components/VehicleManager';
import UserManager from './components/UserManager';

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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Trang đăng nhập - công khai */}
          <Route path="/login" element={<Login />} />

          {/* Chuyển hướng từ / đến /dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Trang tổng quan - tất cả vai trò */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <ProtectedLayout>
                  <Dashboard />
                </ProtectedLayout>
              </PrivateRoute>
            }
          />

          {/* Danh sách lịch trình - tất cả vai trò */}
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
