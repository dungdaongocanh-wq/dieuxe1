// Trang quản lý xe (Biển Kiểm Soát)
import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Popconfirm,
  message,
  Tag,
  Card,
  Tooltip,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';

const { Title } = Typography;

interface Vehicle {
  id: number;
  licensePlate: string;
  vehicleType: string | null;
  fuelRate: number;
  pricePerKm: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

const VehiclePage: React.FC = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm<{
    licensePlate: string;
    vehicleType: string;
    fuelRate: number;
    pricePerKm: number;
    notes: string;
    isActive: boolean;
  }>();

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Vehicle[]>('/api/vehicles');
      setVehicles(res.data);
    } catch {
      void message.error('Không thể tải danh sách xe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVehicles();
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      fuelRate: 8.5,
      pricePerKm: 10000,
      isActive: true,
    });
    setModalOpen(true);
  };

  const handleEdit = (record: Vehicle) => {
    setEditingId(record.id);
    form.setFieldsValue({
      licensePlate: record.licensePlate,
      vehicleType: record.vehicleType || '',
      fuelRate: record.fuelRate,
      pricePerKm: record.pricePerKm,
      notes: record.notes || '',
      isActive: record.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingId) {
        await axios.put(`/api/vehicles/${editingId}`, values);
        void message.success('Cập nhật xe thành công');
      } else {
        await axios.post('/api/vehicles', values);
        void message.success('Thêm xe thành công');
      }

      setModalOpen(false);
      void fetchVehicles();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } }; errorFields?: unknown[] };
      if (!axiosError.errorFields) {
        void message.error(axiosError.response?.data?.message || 'Có lỗi xảy ra');
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await axios.delete<{ message: string }>(`/api/vehicles/${id}`);
      void message.success(res.data.message);
      void fetchVehicles();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      void message.error(axiosError.response?.data?.message || 'Không thể xóa xe');
    }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'fleet_manager';

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Biển Kiểm Soát',
      dataIndex: 'licensePlate',
      key: 'licensePlate',
      render: (val: string) => <strong>{val}</strong>,
    },
    {
      title: 'Loại Xe',
      dataIndex: 'vehicleType',
      key: 'vehicleType',
      render: (val: string | null) => val || '—',
    },
    {
      title: 'Định Mức Xăng',
      dataIndex: 'fuelRate',
      key: 'fuelRate',
      align: 'right' as const,
      render: (val: number) => `${val} lít/100km`,
    },
    {
      title: 'Đơn Giá/KM',
      dataIndex: 'pricePerKm',
      key: 'pricePerKm',
      align: 'right' as const,
      render: (val: number) =>
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val),
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'notes',
      key: 'notes',
      render: (val: string | null) => val || '—',
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'red'}>{val ? 'Hoạt động' : 'Không hoạt động'}</Tag>
      ),
    },
    {
      title: 'Ngày Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => dayjs(val).format('DD/MM/YYYY'),
    },
    ...(canEdit
      ? [
          {
            title: 'Thao Tác',
            key: 'actions',
            render: (_: unknown, record: Vehicle) => (
              <Space>
                <Tooltip title="Chỉnh sửa">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(record)}
                  />
                </Tooltip>
                <Popconfirm
                  title="Xóa xe này?"
                  description="Xe có lịch sử sử dụng sẽ bị vô hiệu hóa thay vì xóa."
                  onConfirm={() => void handleDelete(record.id)}
                  okText="Xóa"
                  cancelText="Hủy"
                >
                  <Tooltip title="Xóa">
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          Quản Lý Biển Kiểm Soát
        </Title>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Thêm Xe
          </Button>
        )}
      </div>

      <Card size="small">
        <Table
          dataSource={vehicles}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          bordered
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: 'Chưa có xe nào' }}
        />
      </Card>

      {/* Modal thêm/sửa xe */}
      <Modal
        title={editingId ? 'Chỉnh Sửa Xe' : 'Thêm Xe Mới'}
        open={modalOpen}
        onOk={() => void handleSave()}
        onCancel={() => setModalOpen(false)}
        okText={editingId ? 'Cập Nhật' : 'Thêm Mới'}
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="licensePlate"
            label="Biển Kiểm Soát"
            rules={[{ required: true, message: 'Vui lòng nhập biển kiểm soát' }]}
          >
            <Input
              placeholder="VD: 99H07049"
              style={{ textTransform: 'uppercase' }}
              disabled={!!editingId}
            />
          </Form.Item>

          <Form.Item name="vehicleType" label="Loại Xe">
            <Input placeholder="VD: Xe tải, Xe van..." />
          </Form.Item>

          <Form.Item
            name="fuelRate"
            label="Định Mức Xăng (lít/100km)"
            rules={[{ required: true }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={0.1}
              placeholder="VD: 8.5"
            />
          </Form.Item>

          <Form.Item
            name="pricePerKm"
            label="Đơn Giá/KM (VND)"
            rules={[{ required: true }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={100}
              placeholder="VD: 10000"
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item name="notes" label="Ghi Chú">
            <Input.TextArea rows={2} />
          </Form.Item>

          {editingId && (
            <Form.Item name="isActive" label="Hoạt Động" valuePropName="checked">
              <Switch checkedChildren="Có" unCheckedChildren="Không" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Space>
  );
};

export default VehiclePage;
