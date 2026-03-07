// Trang bảng lịch trình - BẢNG THEO DÕI TÌNH HÌNH SỬ DỤNG XE
import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Typography,
  Select,
  DatePicker,
  Modal,
  Form,
  Input,
  InputNumber,
  Tag,
  Popconfirm,
  message,
  Row,
  Col,
  Card,
  Statistic,
  Divider,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import * as XLSX from '@e965/xlsx';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

// Định nghĩa kiểu dữ liệu
interface Vehicle {
  id: number;
  licensePlate: string;
  vehicleType: string | null;
  fuelRate: number;
  pricePerKm: number;
}

interface UserWithRole {
  id: number;
  fullName: string;
  username: string;
  role: string;
}

interface Schedule {
  id: number;
  driverId: number;
  driver: UserWithRole;
  vehicleId: number;
  vehicle: Vehicle;
  tripDate: string;
  departurePoint: string;
  destinationPoint: string;
  kmStart: number;
  kmEnd: number;
  kmTotal: number;
  amountBeforeTax: number;
  fuelConsumed: number;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
}

// Định dạng số tiền
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(amount));

const SchedulePage: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm<{
    vehicleId: number;
    driverId?: number;
    tripDate: Dayjs;
    departurePoint: string;
    destinationPoint: string;
    kmStart: number;
    kmEnd: number;
    notes?: string;
  }>();

  // Bộ lọc
  const [filterMonth, setFilterMonth] = useState(dayjs().month() + 1);
  const [filterYear, setFilterYear] = useState(dayjs().year());
  const [filterVehicleId, setFilterVehicleId] = useState<number | undefined>();
  const [filterDriverId, setFilterDriverId] = useState<number | undefined>();

  // Tính toán real-time trong form
  const [calcKmTotal, setCalcKmTotal] = useState(0);
  const [calcAmount, setCalcAmount] = useState(0);
  const [calcFuel, setCalcFuel] = useState(0);

  // Tải dữ liệu
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        month: filterMonth,
        year: filterYear,
      };
      if (filterVehicleId) params.vehicleId = filterVehicleId;
      if (filterDriverId) params.driverId = filterDriverId;

      const res = await axios.get<Schedule[]>('/api/schedules', { params });
      setSchedules(res.data);
    } catch {
      void message.error('Không thể tải dữ liệu lịch trình');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterVehicleId, filterDriverId]);

  useEffect(() => {
    void fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    const fetchData = async () => {
      const [vehiclesRes, usersRes] = await Promise.all([
        axios.get<Vehicle[]>('/api/vehicles?activeOnly=true'),
        axios.get<UserWithRole[]>('/api/users'),
      ]);
      setVehicles(vehiclesRes.data);
      setDrivers(usersRes.data.filter((u) => u.role === 'driver' || user?.role === 'admin'));
    };
    void fetchData();
  }, [user]);

  // Tính toán real-time khi nhập KM
  const handleKmChange = () => {
    const vehicleId = form.getFieldValue('vehicleId') as number | undefined;
    const kmStart = form.getFieldValue('kmStart') as number | undefined;
    const kmEnd = form.getFieldValue('kmEnd') as number | undefined;

    if (kmStart && kmEnd && kmEnd > kmStart) {
      const total = kmEnd - kmStart;
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      const amount = vehicle ? total * vehicle.pricePerKm : total * 10000;
      const fuel = vehicle ? (total * vehicle.fuelRate) / 100 : (total * 8.5) / 100;
      setCalcKmTotal(total);
      setCalcAmount(amount);
      setCalcFuel(fuel);
    } else {
      setCalcKmTotal(0);
      setCalcAmount(0);
      setCalcFuel(0);
    }
  };

  // Mở modal thêm mới
  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      tripDate: dayjs(),
      driverId: user?.role === 'driver' ? user.id : undefined,
    });
    setCalcKmTotal(0);
    setCalcAmount(0);
    setCalcFuel(0);
    setModalOpen(true);
  };

  // Mở modal chỉnh sửa
  const handleEdit = (record: Schedule) => {
    setEditingId(record.id);
    form.setFieldsValue({
      vehicleId: record.vehicleId,
      driverId: record.driverId,
      tripDate: dayjs(record.tripDate),
      departurePoint: record.departurePoint,
      destinationPoint: record.destinationPoint,
      kmStart: record.kmStart,
      kmEnd: record.kmEnd,
      notes: record.notes || '',
    });
    setCalcKmTotal(record.kmTotal);
    setCalcAmount(record.amountBeforeTax);
    setCalcFuel(record.fuelConsumed);
    setModalOpen(true);
  };

  // Lưu lịch trình
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (values.kmEnd <= values.kmStart) {
        void message.error('Số KM kết thúc phải lớn hơn số KM bắt đầu');
        return;
      }

      const payload = {
        ...values,
        tripDate: values.tripDate.format('YYYY-MM-DD'),
        driverId: values.driverId || user?.id,
      };

      if (editingId) {
        await axios.put(`/api/schedules/${editingId}`, payload);
        void message.success('Cập nhật lịch trình thành công');
      } else {
        await axios.post('/api/schedules', payload);
        void message.success('Thêm lịch trình thành công');
      }

      setModalOpen(false);
      void fetchSchedules();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } }; errorFields?: unknown[] };
      if (!axiosError.errorFields) {
        void message.error(axiosError.response?.data?.message || 'Có lỗi xảy ra');
      }
    }
  };

  // Xóa lịch trình
  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/schedules/${id}`);
      void message.success('Đã xóa lịch trình');
      void fetchSchedules();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      void message.error(axiosError.response?.data?.message || 'Không thể xóa');
    }
  };

  // Duyệt / từ chối lịch trình
  const handleStatus = async (id: number, status: string) => {
    try {
      await axios.patch(`/api/schedules/${id}/status`, { status });
      void message.success(status === 'approved' ? 'Đã duyệt lịch trình' : 'Đã từ chối lịch trình');
      void fetchSchedules();
    } catch {
      void message.error('Có lỗi xảy ra');
    }
  };

  // Xuất Excel
  const handleExportExcel = () => {
    const exportData = schedules.map((s, i) => ({
      STT: i + 1,
      'Người Lái': s.driver.fullName,
      Ngày: dayjs(s.tripDate).format('DD/MM/YYYY'),
      'Điểm Đi': s.departurePoint,
      'Điểm Đến': s.destinationPoint,
      'Số KM Điểm Đi': s.kmStart,
      'Số KM Kết Thúc': s.kmEnd,
      'Tổng Số KM': s.kmTotal,
      'Thành Tiền Trước Thuế': s.amountBeforeTax,
      BKS: s.vehicle.licensePlate,
      'Ghi Chú': s.notes || '',
      'Xăng Tiêu Thụ (lít)': s.fuelConsumed.toFixed(2),
      'Trạng Thái': s.status === 'approved' ? 'Đã duyệt' : s.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Tháng ${filterMonth}-${filterYear}`);
    XLSX.writeFile(wb, `LichTrinh_T${filterMonth}_${filterYear}.xlsx`);
    void message.success('Xuất Excel thành công');
  };

  // Tính tổng cuối trang
  const totalKm = schedules.reduce((s, r) => s + r.kmTotal, 0);
  const totalAmount = schedules.reduce((s, r) => s + r.amountBeforeTax, 0);
  const totalFuel = schedules.reduce((s, r) => s + r.fuelConsumed, 0);

  // Quyền thêm/sửa
  const canEdit = ['admin', 'fleet_manager', 'driver'].includes(user?.role || '');
  const canApprove = ['admin', 'fleet_manager'].includes(user?.role || '');
  const canExport = ['admin', 'accountant'].includes(user?.role || '');

  // Trạng thái badge
  const statusTag = (status: string) => {
    if (status === 'approved') return <Tag color="green">Đã duyệt</Tag>;
    if (status === 'rejected') return <Tag color="red">Từ chối</Tag>;
    return <Tag color="orange">Chờ duyệt</Tag>;
  };

  // Cột bảng
  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      fixed: 'left' as const,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Người Lái',
      dataIndex: ['driver', 'fullName'],
      key: 'driver',
      width: 140,
    },
    {
      title: 'Ngày',
      dataIndex: 'tripDate',
      key: 'tripDate',
      width: 100,
      render: (val: string) => dayjs(val).format('DD/MM/YYYY'),
    },
    {
      title: 'Điểm Đi',
      dataIndex: 'departurePoint',
      key: 'departurePoint',
      width: 120,
    },
    {
      title: 'Điểm Đến',
      dataIndex: 'destinationPoint',
      key: 'destinationPoint',
      width: 150,
    },
    {
      title: 'KM Bắt Đầu',
      dataIndex: 'kmStart',
      key: 'kmStart',
      width: 100,
      align: 'right' as const,
      render: (val: number) => val.toLocaleString('vi-VN'),
    },
    {
      title: 'KM Kết Thúc',
      dataIndex: 'kmEnd',
      key: 'kmEnd',
      width: 100,
      align: 'right' as const,
      render: (val: number) => val.toLocaleString('vi-VN'),
    },
    {
      title: 'Tổng KM',
      dataIndex: 'kmTotal',
      key: 'kmTotal',
      width: 90,
      align: 'right' as const,
      render: (val: number) => <Text strong>{val.toFixed(1)}</Text>,
    },
    {
      title: 'Thành Tiền (VND)',
      dataIndex: 'amountBeforeTax',
      key: 'amountBeforeTax',
      width: 130,
      align: 'right' as const,
      render: (val: number) => formatCurrency(val),
    },
    {
      title: 'BKS',
      dataIndex: ['vehicle', 'licensePlate'],
      key: 'vehicle',
      width: 100,
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'notes',
      key: 'notes',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Xăng (lít)',
      dataIndex: 'fuelConsumed',
      key: 'fuelConsumed',
      width: 90,
      align: 'right' as const,
      render: (val: number) => val.toFixed(2),
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: statusTag,
    },
    {
      title: 'Thao Tác',
      key: 'actions',
      width: 130,
      fixed: 'right' as const,
      render: (_: unknown, record: Schedule) => (
        <Space size="small">
          {canEdit && (
            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          )}
          {canApprove && record.status === 'pending' && (
            <>
              <Tooltip title="Duyệt">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined style={{ color: '#52c41a' }} />}
                  onClick={() => void handleStatus(record.id, 'approved')}
                />
              </Tooltip>
              <Tooltip title="Từ chối">
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined style={{ color: '#ff4d4f' }} />}
                  onClick={() => void handleStatus(record.id, 'rejected')}
                />
              </Tooltip>
            </>
          )}
          {canEdit && (
            <Popconfirm
              title="Xóa lịch trình này?"
              onConfirm={() => void handleDelete(record.id)}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Tooltip title="Xóa">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Tên xe đang lọc
  const selectedVehicle = vehicles.find((v) => v.id === filterVehicleId);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* Tiêu đề theo mẫu */}
      <div style={{ textAlign: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          BẢNG THEO DÕI TÌNH HÌNH SỬ DỤNG XE
          {selectedVehicle ? ` (Biển số xe ${selectedVehicle.licensePlate})` : ''}
        </Title>
        <Text type="secondary">Tháng {filterMonth}/{filterYear}</Text>
      </div>

      {/* Bộ lọc và nút thao tác */}
      <Card size="small">
        <Row gutter={[8, 8]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <DatePicker
              picker="month"
              value={dayjs(`${filterYear}-${filterMonth}`, 'YYYY-M')}
              onChange={(date) => {
                if (date) {
                  setFilterMonth(date.month() + 1);
                  setFilterYear(date.year());
                }
              }}
              format="MM/YYYY"
              style={{ width: '100%' }}
              placeholder="Chọn tháng"
              allowClear={false}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              placeholder="Lọc theo xe"
              allowClear
              style={{ width: '100%' }}
              value={filterVehicleId}
              onChange={(val) => setFilterVehicleId(val as number | undefined)}
            >
              {vehicles.map((v) => (
                <Option key={v.id} value={v.id}>
                  {v.licensePlate}
                </Option>
              ))}
            </Select>
          </Col>
          {user?.role !== 'driver' && (
            <Col xs={24} sm={12} md={5}>
              <Select
                placeholder="Lọc theo lái xe"
                allowClear
                style={{ width: '100%' }}
                value={filterDriverId}
                onChange={(val) => setFilterDriverId(val as number | undefined)}
              >
                {drivers.map((d) => (
                  <Option key={d.id} value={d.id}>
                    {d.fullName}
                  </Option>
                ))}
              </Select>
            </Col>
          )}
          <Col xs={24} sm={12} md={8} style={{ textAlign: 'right' }}>
            <Space>
              {canEdit && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAdd}
                >
                  Thêm Chuyến
                </Button>
              )}
              {canExport && (
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={handleExportExcel}
                  disabled={schedules.length === 0}
                >
                  Xuất Excel
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Bảng dữ liệu */}
      <Table
        dataSource={schedules}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1400 }}
        size="small"
        bordered
        pagination={{ pageSize: 20, showTotal: (total) => `Tổng ${total} bản ghi` }}
        locale={{ emptyText: 'Chưa có dữ liệu lịch trình' }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
              <Table.Summary.Cell index={0} colSpan={7} align="right">
                <Text strong>TỔNG CỘNG:</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">
                <Text strong type="danger">{totalKm.toFixed(1)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="right">
                <Text strong type="danger">{formatCurrency(totalAmount)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={9} />
              <Table.Summary.Cell index={10} />
              <Table.Summary.Cell index={11} align="right">
                <Text strong type="danger">{totalFuel.toFixed(2)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={12} colSpan={2} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      {/* Thống kê tổng hợp */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Tổng số chuyến"
              value={schedules.length}
              suffix="chuyến"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Tổng KM"
              value={totalKm.toFixed(1)}
              suffix="km"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Tổng tiền (trước thuế)"
              value={formatCurrency(totalAmount)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Modal nhập liệu */}
      <Modal
        title={editingId ? 'Chỉnh Sửa Lịch Trình' : 'Thêm Lịch Trình Mới'}
        open={modalOpen}
        onOk={() => void handleSave()}
        onCancel={() => setModalOpen(false)}
        okText={editingId ? 'Cập Nhật' : 'Thêm Mới'}
        cancelText="Hủy"
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="middle">
          <Row gutter={16}>
            {/* BKS */}
            <Col xs={24} sm={12}>
              <Form.Item
                name="vehicleId"
                label="Biển Kiểm Soát (BKS)"
                rules={[{ required: true, message: 'Vui lòng chọn xe' }]}
              >
                <Select placeholder="Chọn xe" onChange={handleKmChange}>
                  {vehicles.map((v) => (
                    <Option key={v.id} value={v.id}>
                      {v.licensePlate} — {v.vehicleType || 'Xe tải'}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {/* Ngày */}
            <Col xs={24} sm={12}>
              <Form.Item
                name="tripDate"
                label="Ngày"
                rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}
              >
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  disabledDate={(d) => d.isAfter(dayjs(), 'day')}
                />
              </Form.Item>
            </Col>

            {/* Lái xe (admin/fleet_manager có thể chọn) */}
            {(user?.role === 'admin' || user?.role === 'fleet_manager') && (
              <Col xs={24} sm={12}>
                <Form.Item name="driverId" label="Người Lái">
                  <Select placeholder="Chọn lái xe" allowClear>
                    {drivers.map((d) => (
                      <Option key={d.id} value={d.id}>
                        {d.fullName}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            )}

            {/* Điểm đi */}
            <Col xs={24} sm={12}>
              <Form.Item
                name="departurePoint"
                label="Điểm Đi"
                rules={[{ required: true, message: 'Vui lòng nhập điểm đi' }]}
              >
                <Input placeholder="VD: ILS - TECH" />
              </Form.Item>
            </Col>

            {/* Điểm đến */}
            <Col xs={24} sm={12}>
              <Form.Item
                name="destinationPoint"
                label="Điểm Đến"
                rules={[{ required: true, message: 'Vui lòng nhập điểm đến' }]}
              >
                <Input placeholder="VD: HANSOL, SR" />
              </Form.Item>
            </Col>

            {/* KM bắt đầu */}
            <Col xs={24} sm={12}>
              <Form.Item
                name="kmStart"
                label="Số KM Điểm Đi (đồng hồ)"
                rules={[{ required: true, message: 'Vui lòng nhập KM bắt đầu' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="VD: 10000"
                  onChange={handleKmChange}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>

            {/* KM kết thúc */}
            <Col xs={24} sm={12}>
              <Form.Item
                name="kmEnd"
                label="Số KM Kết Thúc (đồng hồ)"
                rules={[{ required: true, message: 'Vui lòng nhập KM kết thúc' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="VD: 10085"
                  onChange={handleKmChange}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>

            {/* Ghi chú */}
            <Col xs={24}>
              <Form.Item name="notes" label="Ghi Chú">
                <Input.TextArea rows={2} placeholder="Ghi chú thêm (nếu có)" />
              </Form.Item>
            </Col>
          </Row>

          {/* Preview tính toán real-time */}
          {calcKmTotal > 0 && (
            <>
              <Divider dashed style={{ margin: '8px 0' }} />
              <Row gutter={16}>
                <Col xs={8}>
                  <Statistic
                    title="Tổng KM tuyến đường"
                    value={calcKmTotal.toFixed(1)}
                    suffix="km"
                    valueStyle={{ fontSize: 16, color: '#1677ff' }}
                  />
                </Col>
                <Col xs={8}>
                  <Statistic
                    title="Thành tiền (trước thuế)"
                    value={formatCurrency(calcAmount)}
                    suffix="VND"
                    valueStyle={{ fontSize: 16, color: '#52c41a' }}
                  />
                </Col>
                <Col xs={8}>
                  <Statistic
                    title="Xăng tiêu thụ"
                    value={calcFuel.toFixed(2)}
                    suffix="lít"
                    valueStyle={{ fontSize: 16, color: '#fa8c16' }}
                  />
                </Col>
              </Row>
            </>
          )}
        </Form>
      </Modal>
    </Space>
  );
};

export default SchedulePage;
