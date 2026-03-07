// App chính - cấu hình routing
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { AuthProvider, useAuth } from './context/AuthContext';

// Lazy load các trang
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SchedulePage from './pages/SchedulePage';
import VehiclePage from './pages/VehiclePage';
import UserPage from './pages/UserPage';
import ReportPage from './pages/ReportPage';
import MainLayout from './components/MainLayout';

dayjs.locale('vi');

// Component bảo vệ route yêu cầu đăng nhập
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

// Routing chính
const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="schedules" element={<SchedulePage />} />
        <Route path="vehicles" element={<VehiclePage />} />
        <Route path="users" element={<UserPage />} />
        <Route path="reports" element={<ReportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
