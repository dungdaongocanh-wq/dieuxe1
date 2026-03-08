/**
 * Tính kỳ thanh toán từ tháng YYYY-MM
 * Kỳ = từ ngày 26 tháng trước → ngày 25 tháng được chọn
 * @param {string} month - YYYY-MM
 * @returns {{ periodStart: string, periodEnd: string }}
 */
export function getPeriodFromMonth(month) {
  const [yr, mo] = month.split('-').map(Number);
  const prevMonth = mo === 1 ? 12 : mo - 1;
  const prevYear = mo === 1 ? yr - 1 : yr;
  const periodStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-26`;
  const periodEnd = `${yr}-${String(mo).padStart(2, '0')}-25`;
  return { periodStart, periodEnd };
}
