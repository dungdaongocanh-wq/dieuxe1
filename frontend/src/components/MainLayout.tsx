// Layout chính với sidebar navigation
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Menu,
  Button,
  Avatar,
  Dropdown,
  Space,
  Typography,
  theme,
} from 'antd';
import {
  DashboardOutlined,
  CarOutlined,
  CalendarOutlined,
  UserOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// Nhãn vai trò tiếng Việt
const roleLabel: Record<string, string> = {
  admin: 'Quản lý cấp cao',
  accountant: 'Kế toán',
  fleet_manager: 'Quản lý lái xe',
  driver: 'Lái xe',
};

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  // Xác định menu item đang active
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path.startsWith('/schedules')) return 'schedules';
    if (path.startsWith('/vehicles')) return 'vehicles';
    if (path.startsWith('/users')) return 'users';
    if (path.startsWith('/reports')) return 'reports';
    return 'dashboard';
  };

  // Menu items theo quyền
  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Tổng Quan',
      onClick: () => navigate('/'),
    },
    {
      key: 'schedules',
      icon: <CalendarOutlined />,
      label: 'Lịch Trình',
      onClick: () => navigate('/schedules'),
    },
    // Quản lý xe: admin và fleet_manager
    ...(user?.role === 'admin' || user?.role === 'fleet_manager'
      ? [
          {
            key: 'vehicles',
            icon: <CarOutlined />,
            label: 'Quản Lý Xe',
            onClick: () => navigate('/vehicles'),
          },
        ]
      : []),
    // Quản lý tài khoản: chỉ admin
    ...(user?.role === 'admin'
      ? [
          {
            key: 'users',
            icon: <UserOutlined />,
            label: 'Tài Khoản',
            onClick: () => navigate('/users'),
          },
        ]
      : []),
    // Báo cáo: admin và accountant
    ...(user?.role === 'admin' || user?.role === 'accountant'
      ? [
          {
            key: 'reports',
            icon: <BarChartOutlined />,
            label: 'Báo Cáo',
            onClick: () => navigate('/reports'),
          },
        ]
      : []),
  ];

  // Dropdown menu người dùng
  const userMenuItems = [
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: `${user?.fullName} (${roleLabel[user?.role || '']})`,
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng Xuất',
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          background: '#001529',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
        }}
        width={220}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <CarOutlined style={{ fontSize: 24, color: '#1677ff', marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && (
            <Text
              strong
              style={{
                color: 'white',
                fontSize: 13,
                lineHeight: '1.2',
                textAlign: 'center',
              }}
            >
              DNA Express
            </Text>
          )}
        </div>

        {/* Navigation Menu */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      {/* Main layout */}
      <Layout>
        {/* Header */}
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          {/* Toggle sidebar */}
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />

          {/* Tiêu đề công ty */}
          <Text strong style={{ fontSize: 14, color: '#1677ff' }}>
            CÔNG TY TNHH DNA EXPRESS VIỆT NAM
          </Text>

          {/* User info */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                style={{ backgroundColor: '#1677ff' }}
                icon={<UserOutlined />}
              />
              <Space direction="vertical" size={0} style={{ lineHeight: 1.2 }}>
                <Text strong style={{ fontSize: 13 }}>{user?.fullName}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {roleLabel[user?.role || '']}
                </Text>
              </Space>
            </Space>
          </Dropdown>
        </Header>

        {/* Content */}
        <Content
          style={{
            margin: '16px',
            minHeight: 'calc(100vh - 96px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
