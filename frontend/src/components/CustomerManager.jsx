// Component quản lý khách hàng (admin và fleet_manager)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// Form thêm/sửa khách hàng
function CustomerFormModal({ customerToEdit, onSave, onClose, getAuthHeaders }) {
  const [formData, setFormData] = useState({
    short_name: customerToEdit?.short_name || '',
    company_name: customerToEdit?.company_name || '',
    address: customerToEdit?.address || '',
    tax_code: customerToEdit?.tax_code || '',
    email: customerToEdit?.email || '',
    is_active: customerToEdit?.is_active !== undefined ? customerToEdit.is_active : 1
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [pricingRows, setPricingRows] = useState([]);
  const [existingPricing, setExistingPricing] = useState([]);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await fetch('/api/vehicles', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setVehicles(data.filter(v => v.is_active));
        }
      } catch (err) {
        console.error('Lỗi khi tải xe:', err);
      }
    };

    const fetchPricing = async () => {
      if (!customerToEdit) return;
      try {
        const res = await fetch(`/api/customers/${customerToEdit.id}/pricing`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setExistingPricing(data);
          setPricingRows(data.map(p => ({
            id: p.id,
            vehicle_id: p.vehicle_id,
            combo_km_threshold: p.combo_km_threshold ?? '',
            combo_price: p.combo_price ?? '',
            price_per_km_after: p.price_per_km_after ?? '',
            isExisting: true
          })));
        }
      } catch (err) {
        console.error('Lỗi khi tải cấu hình giá:', err);
      }
    };

    fetchVehicles();
    fetchPricing();
  }, [customerToEdit]);

  const addPricingRow = () => {
    setPricingRows(prev => [...prev, {
      tempId: Date.now(),
      vehicle_id: '',
      combo_km_threshold: '',
      combo_price: '',
      price_per_km_after: '',
      isExisting: false
    }]);
  };

  const removePricingRow = (index) => {
    setPricingRows(prev => prev.filter((_, i) => i !== index));
  };

  const updatePricingRow = (index, field, value) => {
    setPricingRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.short_name.trim() || !formData.company_name.trim()) {
      setError('Tên viết tắt và tên công ty là bắt buộc');
      return;
    }

    setLoading(true);
    try {
      const url = customerToEdit ? `/api/customers/${customerToEdit.id}` : '/api/customers';
      const method = customerToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        return;
      }

      const savedCustomerId = data.id;

      // Xử lý cấu hình giá
      for (const row of pricingRows) {
        if (!row.vehicle_id) continue;
        const pricingPayload = {
          vehicle_id: parseInt(row.vehicle_id),
          combo_km_threshold: row.combo_km_threshold !== '' ? parseFloat(row.combo_km_threshold) : null,
          combo_price: row.combo_price !== '' ? parseFloat(row.combo_price) : null,
          price_per_km_after: row.price_per_km_after !== '' ? parseFloat(row.price_per_km_after) : null
        };

        if (row.isExisting && row.id) {
          await fetch(`/api/customers/${savedCustomerId}/pricing/${row.id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(pricingPayload)
          });
        } else {
          await fetch(`/api/customers/${savedCustomerId}/pricing`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(pricingPayload)
          });
        }
      }

      // Xóa các dòng pricing đã bị xóa khỏi UI
      for (const ep of existingPricing) {
        const stillExists = pricingRows.some(r => r.isExisting && r.id === ep.id);
        if (!stillExists) {
          await fetch(`/api/customers/${savedCustomerId}/pricing/${ep.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
        }
      }

      onSave(data, !!customerToEdit);
    } catch {
      setError('Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {customerToEdit ? '✏️ Sửa Khách Hàng' : '➕ Thêm Khách Hàng'}
        </h3>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tên viết tắt và Tên công ty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên viết tắt <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.short_name}
                onChange={e => setFormData(f => ({ ...f, short_name: e.target.value }))}
                required
                placeholder="VD: HANSOL"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mã số thuế
              </label>
              <input
                type="text"
                value={formData.tax_code}
                onChange={e => setFormData(f => ({ ...f, tax_code: e.target.value }))}
                placeholder="0301234567"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>

          {/* Tên công ty đầy đủ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên công ty <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.company_name}
              onChange={e => setFormData(f => ({ ...f, company_name: e.target.value }))}
              required
              placeholder="Công ty TNHH ..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Địa chỉ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Địa chỉ
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={e => setFormData(f => ({ ...f, address: e.target.value }))}
              placeholder="Địa chỉ công ty"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
              placeholder="contact@company.com"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Trạng thái */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cust_is_active"
              checked={formData.is_active === 1}
              onChange={e => setFormData(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="cust_is_active" className="text-sm text-gray-700">
              Khách hàng đang hoạt động
            </label>
          </div>

          {/* Cảnh báo khi sửa giá */}
          {customerToEdit && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-start gap-2">
              <span className="text-yellow-500 text-base mt-0.5">⚠️</span>
              <p className="text-xs text-yellow-800">
                <strong>Lưu ý:</strong> Các chuyến đã lưu sẽ <strong>không tự cập nhật</strong> khi bạn thay đổi giá ở đây.
                Nếu bạn muốn áp dụng giá mới cho một khoảng thời gian nào đó, vui lòng liên hệ <strong>Admin</strong> để sử dụng chức năng "Tính lại giá".
              </p>
            </div>
          )}

          {/* Cấu hình đơn giá theo xe */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Cấu hình đơn giá theo xe</h4>
              <button
                type="button"
                onClick={addPricingRow}
                className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-md font-medium transition-colors"
              >
                + Thêm dòng
              </button>
            </div>
            {pricingRows.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">Chưa có cấu hình giá nào</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b">
                      <th className="text-left py-1 pr-2 font-medium">Chọn Xe</th>
                      <th className="text-left py-1 pr-2 font-medium">Dưới bao nhiêu km (combo)</th>
                      <th className="text-left py-1 pr-2 font-medium">Giá combo (VNĐ)</th>
                      <th className="text-left py-1 pr-2 font-medium">Sau đó /km (VNĐ)</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingRows.map((row, idx) => (
                      <tr key={row.id || row.tempId} className="border-b border-gray-100">
                        <td className="pr-2 py-1">
                          <select
                            value={row.vehicle_id}
                            onChange={e => updatePricingRow(idx, 'vehicle_id', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                          >
                            <option value="">-- Chọn xe --</option>
                            {vehicles.map(v => (
                              <option key={v.id} value={v.id}>{v.license_plate}</option>
                            ))}
                          </select>
                        </td>
                        <td className="pr-2 py-1">
                          <input
                            type="number"
                            value={row.combo_km_threshold}
                            onChange={e => updatePricingRow(idx, 'combo_km_threshold', e.target.value)}
                            min="0"
                            step="0.1"
                            placeholder="VD: 50"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                          />
                        </td>
                        <td className="pr-2 py-1">
                          <input
                            type="number"
                            value={row.combo_price}
                            onChange={e => updatePricingRow(idx, 'combo_price', e.target.value)}
                            min="0"
                            step="1000"
                            placeholder="VD: 500000"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                          />
                        </td>
                        <td className="pr-2 py-1">
                          <input
                            type="number"
                            value={row.price_per_km_after}
                            onChange={e => updatePricingRow(idx, 'price_per_km_after', e.target.value)}
                            min="0"
                            step="100"
                            placeholder="VD: 10000"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                          />
                        </td>
                        <td className="py-1">
                          <button
                            type="button"
                            onClick={() => removePricingRow(idx)}
                            className="text-red-500 hover:text-red-700 p-1 rounded"
                            title="Xóa dòng"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Đang lưu...' : (customerToEdit ? 'Cập nhật' : 'Thêm mới')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2.5 rounded-lg transition-colors"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerManager() {
  const { getAuthHeaders } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers', { headers: getAuthHeaders() });
      if (res.ok) setCustomers(await res.json());
    } catch (err) {
      console.error('Lỗi khi tải khách hàng:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Xử lý sau khi lưu khách hàng
   */
  const handleSave = (savedCustomer, isEdit) => {
    if (isEdit) {
      setCustomers(prev => prev.map(c => c.id === savedCustomer.id ? savedCustomer : c));
      setMessage('✅ Đã cập nhật khách hàng thành công');
    } else {
      setCustomers(prev => [savedCustomer, ...prev]);
      setMessage('✅ Đã thêm khách hàng mới thành công');
    }
    setShowModal(false);
    setEditingCustomer(null);
    setTimeout(() => setMessage(''), 3000);
  };

  /**
   * Xóa khách hàng
   */
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (res.ok) {
        setCustomers(prev => prev.filter(c => c.id !== id));
        setMessage('✅ Đã xóa khách hàng thành công');
      } else {
        setMessage(`❌ ${data.message}`);
      }
      setTimeout(() => setMessage(''), 4000);
      setConfirmDelete(null);
    } catch {
      setMessage('❌ Không thể kết nối đến server');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Quản Lý Khách Hàng</h1>
        <button
          onClick={() => { setEditingCustomer(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Thêm Khách Hàng
        </button>
      </div>

      {/* Thông báo */}
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          message.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* Bảng khách hàng */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto mb-3"></div>
            <p className="text-gray-500">Đang tải...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">🏢</div>
            <p>Chưa có khách hàng nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['STT', 'Tên viết tắt', 'Tên công ty', 'Địa chỉ', 'MST', 'Email', 'Trạng thái', 'Hành động'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c, index) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {c.short_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.company_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{c.address || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{c.tax_code || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.is_active ? 'Hoạt động' : 'Ngừng HĐ'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingCustomer(c); setShowModal(true); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors text-sm"
                          title="Sửa"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setConfirmDelete(c.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors text-sm"
                          title="Xóa"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal thêm/sửa */}
      {showModal && (
        <CustomerFormModal
          customerToEdit={editingCustomer}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingCustomer(null); }}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {/* Xác nhận xóa */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="text-5xl mb-3">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Xác Nhận Xóa</h3>
            <p className="text-gray-600 text-sm mb-4">
              Bạn có chắc muốn xóa khách hàng này? Không thể xóa nếu đang có người dùng liên kết.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium"
              >
                Xóa
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 rounded-lg font-medium"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerManager;
