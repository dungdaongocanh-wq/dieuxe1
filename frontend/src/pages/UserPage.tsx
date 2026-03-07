// Trang quản lý tài khoản người dùng
import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  Select,
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
const { Option } = Select;

interface UserData {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

// Nhãn vai trò
const roleLabel: Record<string, string> = {
  admin: 'Quản lý cấp cao',
  accountant: 'Kế toán',
  fleet_manager: 'Quản lý lái xe',
  driver: 'Lái xe',
};

const roleColor: Record<string, string> = {
  admin: 'red',
  accountant: 'blue',
  fleet_manager: 'orange',
  driver: 'green',
};

const UserPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm<{
    username: string;
    password: string;
    fullName: string;
    role: string;
    isActive: boolean;
  }>();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get<UserData[]>('/api/users');
      setUsers(res.data);
    } catch {
      void message.error('Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (record: UserData) => {
    setEditingId(record.id);
    form.setFieldsValue({
      username: record.username,
      fullName: record.fullName,
      role: record.role,
      isActive: record.isActive,
      password: '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingId) {
        // Khi sửa, không gửi password nếu để trống
        const updateData = { ...values };
        if (!updateData.password) {
          delete (updateData as Partial<typeof updateData>).password;
        }
        await axios.put(`/api/users/${editingId}`, updateData);
        void message.success('Cập nhật tài khoản thành công');
      } else {
        await axios.post('/api/users', values);
        void message.success('Tạo tài khoản thành công');
      }

      setModalOpen(false);
      void fetchUsers();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } }; errorFields?: unknown[] };
      if (!axiosError.errorFields) {
        void message.error(axiosError.response?.data?.message || 'Có lỗi xảy ra');
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await axios.delete<{ message: string }>(`/api/users/${id}`);
      void message.success(res.data.message);
      void fetchUsers();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      void message.error(axiosError.response?.data?.message || 'Không thể xóa tài khoản');
    }
  };

  // Chỉ admin được quản lý tài khoản
  const isAdmin = currentUser?.role === 'admin';

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Tên Đăng Nhập',
      dataIndex: 'username',
      key: 'username',
      render: (val: string) => <strong>{val}</strong>,
    },
    {
      title: 'Họ Tên',
      dataIndex: 'fullName',
      key: 'fullName',
    },
    {
      title: 'Vai Trò',
      dataIndex: 'role',
      key: 'role',
      render: (val: string) => (
        <Tag color={roleColor[val] || 'default'}>{roleLabel[val] || val}</Tag>
      ),
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'red'}>{val ? 'Hoạt động' : 'Khóa'}</Tag>
      ),
    },
    {
      title: 'Ngày Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => dayjs(val).format('DD/MM/YYYY'),
    },
    ...(isAdmin
      ? [
          {
            title: 'Thao Tác',
            key: 'actions',
            render: (_: unknown, record: UserData) => (
              <Space>
                <Tooltip title="Chỉnh sửa">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(record)}
                  />
                </Tooltip>
                {record.id !== currentUser?.id && (
                  <Popconfirm
                    title="Xóa tài khoản này?"
                    description="Tài khoản có lịch sử hoạt động sẽ bị vô hiệu hóa."
                    onConfirm={() => void handleDelete(record.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                  >
                    <Tooltip title="Xóa">
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                )}
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
          Quản Lý Tài Khoản
        </Title>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Thêm Tài Khoản
          </Button>
        )}
      </div>

      <Card size="small">
        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          bordered
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: 'Chưa có tài khoản nào' }}
        />
      </Card>

      {/* Modal thêm/sửa tài khoản */}
      <Modal
        title={editingId ? 'Chỉnh Sửa Tài Khoản' : 'Tạo Tài Khoản Mới'}
        open={modalOpen}
        onOk={() => void handleSave()}
        onCancel={() => setModalOpen(false)}
        okText={editingId ? 'Cập Nhật' : 'Tạo Mới'}
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="Tên Đăng Nhập"
            rules={[
              { required: true, message: 'Vui lòng nhập tên đăng nhập' },
              { min: 3, message: 'Tối thiểu 3 ký tự' },
            ]}
          >
            <Input placeholder="VD: nguyenvana" disabled={!!editingId} />
          </Form.Item>

          <Form.Item
            name="fullName"
            label="Họ Tên"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
          >
            <Input placeholder="VD: Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingId ? 'Mật Khẩu Mới (để trống nếu không đổi)' : 'Mật Khẩu'}
            rules={
              editingId
                ? [{ min: 6, message: 'Mật khẩu ít nhất 6 ký tự' }]
                : [
                    { required: true, message: 'Vui lòng nhập mật khẩu' },
                    { min: 6, message: 'Mật khẩu ít nhất 6 ký tự' },
                  ]
            }
          >
            <Input.Password placeholder="Ít nhất 6 ký tự" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Vai Trò"
            rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
          >
            <Select placeholder="Chọn vai trò">
              <Option value="admin">Quản lý cấp cao</Option>
              <Option value="accountant">Kế toán</Option>
              <Option value="fleet_manager">Quản lý lái xe</Option>
              <Option value="driver">Lái xe</Option>
            </Select>
          </Form.Item>

          {editingId && (
            <Form.Item name="isActive" label="Trạng Thái" valuePropName="checked">
              <Switch checkedChildren="Hoạt động" unCheckedChildren="Khóa" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Space>
  );
};

export default UserPage;
