// Tiện ích gọi API - tự động thêm base URL cho production
const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Wrapper cho fetch() tự động thêm API base URL
 * @param {string} path - Đường dẫn API (bắt đầu bằng /)
 * @param {RequestInit} options - Tùy chọn fetch
 */
export function apiFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, options);
}

export default API_BASE;
