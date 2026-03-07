// Trang báo cáo theo tháng
import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  DatePicker,
  Button,
  Table,
  Statistic,
  Space,
  message,
  Spin,
  Divider,
} from 'antd';
import { FileExcelOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import * as XLSX from '@e965/xlsx';

const { Title, Text } = Typography;

// Kiểu dữ liệu báo cáo
interface ReportData {
  month: number;
  year: number;
  summary: {
    totalTrips: number;
    totalKm: number;
    totalAmount: number;
    totalFuel: number;
  };
  byVehicle: {
    licensePlate: string;
    vehicleType: string | null;
    totalTrips: number;
    totalKm: number;
    totalAmount: number;
    totalFuel: number;
  }[];
  byDriver: {
    fullName: string;
    username: string;
    totalTrips: number;
    totalKm: number;
    totalAmount: number;
    totalFuel: number;
  }[];
  schedules: {
    id: number;
    tripDate: string;
    driver: { fullName: string };
    vehicle: { licensePlate: string };
    departurePoint: string;
    destinationPoint: string;
    kmStart: number;
    kmEnd: number;
    kmTotal: number;
    amountBeforeTax: number;
    fuelConsumed: number;
    notes: string | null;
  }[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(amount));

const ReportPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  // Tải báo cáo
  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get<ReportData>('/api/reports/monthly', {
        params: {
          month: selectedDate.month() + 1,
          year: selectedDate.year(),
        },
      });
      setReportData(res.data);
    } catch {
      void message.error('Không thể tải báo cáo. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Xuất Excel
  const handleExportExcel = () => {
    if (!reportData) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Chi tiết lịch trình
    const detailData = reportData.schedules.map((s, i) => ({
      STT: i + 1,
      Ngày: dayjs(s.tripDate).format('DD/MM/YYYY'),
      'Người Lái': s.driver.fullName,
      BKS: s.vehicle.licensePlate,
      'Điểm Đi': s.departurePoint,
      'Điểm Đến': s.destinationPoint,
      'KM Bắt Đầu': s.kmStart,
      'KM Kết Thúc': s.kmEnd,
      'Tổng KM': s.kmTotal,
      'Thành Tiền (VND)': s.amountBeforeTax,
      'Xăng (lít)': s.fuelConsumed.toFixed(2),
      'Ghi Chú': s.notes || '',
    }));
    const ws1 = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Chi Tiết');

    // Sheet 2: Theo xe
    const vehicleData = reportData.byVehicle.map((v, i) => ({
      STT: i + 1,
      BKS: v.licensePlate,
      'Loại Xe': v.vehicleType || '',
      'Số Chuyến': v.totalTrips,
      'Tổng KM': v.totalKm.toFixed(1),
      'Tổng Tiền (VND)': v.totalAmount,
      'Tổng Xăng (lít)': v.totalFuel.toFixed(2),
    }));
    const ws2 = XLSX.utils.json_to_sheet(vehicleData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Theo Xe');

    // Sheet 3: Theo lái xe
    const driverData = reportData.byDriver.map((d, i) => ({
      STT: i + 1,
      'Tên Lái Xe': d.fullName,
      Username: d.username,
      'Số Chuyến': d.totalTrips,
      'Tổng KM': d.totalKm.toFixed(1),
      'Tổng Tiền (VND)': d.totalAmount,
      'Tổng Xăng (lít)': d.totalFuel.toFixed(2),
    }));
    const ws3 = XLSX.utils.json_to_sheet(driverData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Theo Lái Xe');

    XLSX.writeFile(
      wb,
      `BaoCao_T${reportData.month}_${reportData.year}_DNAExpress.xlsx`
    );
    void message.success('Xuất Excel thành công');
  };

  // Cột bảng theo xe
  const vehicleColumns = [
    { title: 'STT', key: 'stt', width: 55, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: 'Biển Kiểm Soát', dataIndex: 'licensePlate', key: 'licensePlate' },
    { title: 'Loại Xe', dataIndex: 'vehicleType', key: 'vehicleType', render: (v: string | null) => v || '—' },
    { title: 'Số Chuyến', dataIndex: 'totalTrips', key: 'totalTrips', align: 'right' as const },
    {
      title: 'Tổng KM',
      dataIndex: 'totalKm',
      key: 'totalKm',
      align: 'right' as const,
      render: (v: number) => v.toFixed(1),
    },
    {
      title: 'Tổng Tiền (VND)',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (v: number) => formatCurrency(v),
    },
    {
      title: 'Xăng Tiêu Thụ (lít)',
      dataIndex: 'totalFuel',
      key: 'totalFuel',
      align: 'right' as const,
      render: (v: number) => v.toFixed(2),
    },
  ];

  // Cột bảng theo lái xe
  const driverColumns = [
    { title: 'STT', key: 'stt', width: 55, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: 'Tên Lái Xe', dataIndex: 'fullName', key: 'fullName' },
    { title: 'Số Chuyến', dataIndex: 'totalTrips', key: 'totalTrips', align: 'right' as const },
    {
      title: 'Tổng KM',
      dataIndex: 'totalKm',
      key: 'totalKm',
      align: 'right' as const,
      render: (v: number) => v.toFixed(1),
    },
    {
      title: 'Tổng Tiền (VND)',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (v: number) => formatCurrency(v),
    },
    {
      title: 'Xăng Tiêu Thụ (lít)',
      dataIndex: 'totalFuel',
      key: 'totalFuel',
      align: 'right' as const,
      render: (v: number) => v.toFixed(2),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>
        Báo Cáo Theo Tháng
      </Title>

      {/* Bộ lọc */}
      <Card size="small">
        <Row gutter={[16, 8]} align="middle">
          <Col>
            <Text>Chọn tháng: </Text>
            <DatePicker
              picker="month"
              value={selectedDate}
              onChange={(date) => date && setSelectedDate(date)}
              format="MM/YYYY"
              allowClear={false}
            />
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => void fetchReport()}
              loading={loading}
            >
              Xem Báo Cáo
            </Button>
          </Col>
          {reportData && (
            <Col>
              <Button
                icon={<FileExcelOutlined />}
                onClick={handleExportExcel}
              >
                Xuất Excel
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && reportData && (
        <>
          {/* Tiêu đề báo cáo */}
          <div style={{ textAlign: 'center' }}>
            <Title level={5} style={{ margin: 0 }}>
              BÁO CÁO TỔNG HỢP THÁNG {reportData.month}/{reportData.year}
            </Title>
            <Text type="secondary">CÔNG TY TNHH DNA EXPRESS VIỆT NAM</Text>
          </div>

          {/* Tổng hợp chung */}
          <Card
            title={<Text strong>Tổng Kết</Text>}
            size="small"
          >
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Statistic title="Số Chuyến" value={reportData.summary.totalTrips} suffix="chuyến" />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Tổng KM"
                  value={reportData.summary.totalKm.toFixed(1)}
                  suffix="km"
                  valueStyle={{ color: '#1677ff' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Tổng Tiền (trước thuế)"
                  value={formatCurrency(reportData.summary.totalAmount)}
                  suffix="VND"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Xăng Tiêu Thụ"
                  value={reportData.summary.totalFuel.toFixed(2)}
                  suffix="lít"
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Col>
            </Row>
          </Card>

          <Divider style={{ margin: '8px 0' }} />

          {/* Tổng hợp theo xe */}
          <Card title={<Text strong>Theo Biển Kiểm Soát</Text>} size="small">
            <Table
              dataSource={reportData.byVehicle}
              columns={vehicleColumns}
              rowKey="licensePlate"
              pagination={false}
              size="small"
              bordered
              locale={{ emptyText: 'Không có dữ liệu' }}
            />
          </Card>

          {/* Tổng hợp theo lái xe */}
          <Card title={<Text strong>Theo Lái Xe</Text>} size="small">
            <Table
              dataSource={reportData.byDriver}
              columns={driverColumns}
              rowKey="username"
              pagination={false}
              size="small"
              bordered
              locale={{ emptyText: 'Không có dữ liệu' }}
            />
          </Card>
        </>
      )}

      {!loading && !reportData && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
            Chọn tháng và nhấn "Xem Báo Cáo" để xem dữ liệu
          </div>
        </Card>
      )}
    </Space>
  );
};

export default ReportPage;
