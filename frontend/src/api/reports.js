import api from './axios';

// name: usage-by-type | utilization | idle | damage | late | students | departments | peak-hours
export const getReport = (name, params = {}) => api.get(`/reports/${name}`, { params });

// CSV needs the login token, so it is fetched with axios and saved from the browser (admin only).
export async function downloadReportCsv(name, params = {}) {
  const res = await api.get(`/reports/${name}`, { params: { ...params, format: 'csv' }, responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${params.from || 'last'}_${params.to || params.days || ''}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
