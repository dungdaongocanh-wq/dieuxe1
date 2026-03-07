// Trang tổng quan (Dashboard)
import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Space,
  Spin,
  Table,
} from 'antd';
import {
  CarOutlined,
  RiseOutlined,
  DollarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// Định dạng số tiền VND
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

interface DashboardData {
  today: { trips: number; km: number; cost: number };
  month: { trips: number; km: number; cost: number; fuel: number };
  kmByDay: { date: string; km: number }[];
  topDrivers: { fullName: string; totalKm: number }[];
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await axios.get<DashboardData>('/api/reports/dashboard');
        setData(res.data);
      } catch (err) {
        console.error('Lỗi tải dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    void fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  const currentMonth = dayjs().format('MM/YYYY');
  const today = dayjs().format('DD/MM/YYYY');

  const topDriverColumns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Lái Xe',
      dataIndex: 'fullName',
      key: 'fullName',
    },
    {
      title: 'Tổng KM',
      dataIndex: 'totalKm',
      key: 'totalKm',
      render: (val: number) => `${val.toFixed(1)} km`,
      align: 'right' as const,
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* Tiêu đề */}
      <Title level={4} style={{ margin: 0 }}>
        Tổng Quan
      </Title>

      {/* Thống kê hôm nay */}
      <Card
        title={<Text strong>📅 Hôm nay ({today})</Text>}
        size="small"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Statistic
              title="Số chuyến"
              value={data?.today.trips || 0}
              prefix={<CarOutlined />}
              suffix="chuyến"
              valueStyle={{ color: '#1677ff' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="Tổng KM"
              value={data?.today.km?.toFixed(1) || 0}
              prefix={<RiseOutlined />}
              suffix="km"
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="Chi phí"
              value={formatCurrency(data?.today.cost || 0)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
        </Row>
      </Card>

      {/* Thống kê tháng */}
      <Card
        title={<Text strong>📊 Tháng {currentMonth}</Text>}
        size="small"
      >
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Statistic
              title="Số chuyến"
              value={data?.month.trips || 0}
              suffix="chuyến"
              valueStyle={{ color: '#1677ff' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Tổng KM"
              value={data?.month.km?.toFixed(1) || 0}
              suffix="km"
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Chi phí"
              value={formatCurrency(data?.month.cost || 0)}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Xăng tiêu thụ"
              value={data?.month.fuel?.toFixed(1) || 0}
              prefix={<ThunderboltOutlined />}
              suffix="lít"
              valueStyle={{ color: '#722ed1' }}
            />
          </Col>
        </Row>
      </Card>

      {/* Top lái xe */}
      <Card
        title={<Text strong>🏆 Top Lái Xe Nhiều KM Nhất (Tháng {currentMonth})</Text>}
        size="small"
      >
        <Table
          dataSource={data?.topDrivers || []}
          columns={topDriverColumns}
          rowKey="fullName"
          pagination={false}
          size="small"
          locale={{ emptyText: 'Chưa có dữ liệu trong tháng này' }}
        />
      </Card>

      {/* Bảng KM theo ngày */}
      {data?.kmByDay && data.kmByDay.length > 0 && (
        <Card
          title={<Text strong>📈 KM theo ngày (Tháng {currentMonth})</Text>}
          size="small"
        >
          <Table
            dataSource={data.kmByDay}
            columns={[
              {
                title: 'Ngày',
                dataIndex: 'date',
                key: 'date',
                render: (val: string) => dayjs(val).format('DD/MM/YYYY'),
              },
              {
                title: 'Tổng KM',
                dataIndex: 'km',
                key: 'km',
                render: (val: number) => `${val.toFixed(1)} km`,
                align: 'right',
              },
            ]}
            rowKey="date"
            pagination={false}
            size="small"
          />
        </Card>
      )}
    </Space>
  );
};

export default Dashboard;
