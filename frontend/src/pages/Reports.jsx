import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getReport, downloadReportCsv } from '../api/reports';
import api from '../api/axios';

const REPORTS = [
  { key: 'usage-by-type', label: 'Usage by equipment', about: 'How often and how long each equipment type was used.',
    cols: [['name', 'Equipment'], ['category', 'Category'], ['sessions', 'Sessions'], ['hours', 'Hours used']] },
  { key: 'utilization', label: 'Utilization', about: 'Hours used compared with the hours each equipment type was open for use.',
    cols: [['name', 'Equipment'], ['units', 'Units'], ['usedHours', 'Hours used'], ['capacityHours', 'Hours available'], ['utilizationPercent', 'Utilization %']] },
  { key: 'idle', label: 'Idle units', about: 'Units nobody has borrowed in the last number of days.', noRange: true,
    cols: [['unitCode', 'Unit'], ['typeName', 'Equipment'], ['status', 'Status'], ['lastUsedAt', 'Last used']] },
  { key: 'damage', label: 'Damage', about: 'Damage and loss reports against how many times the equipment was issued.',
    cols: [['name', 'Equipment'], ['reports', 'Reports'], ['damages', 'Damaged'], ['losses', 'Lost'], ['issues', 'Times issued'], ['ratePercent', 'Rate %']] },
  { key: 'late', label: 'Late returns', about: 'On-time rate and students who return late most often.',
    cols: [['name', 'Student'], ['srn', 'SRN'], ['department', 'Department'], ['lateCount', 'Late returns'], ['totalLateMinutes', 'Total late (min)'], ['avgLateMinutes', 'Average late (min)']] },
  { key: 'students', label: 'Students', about: 'How many times each student borrowed equipment. Opening this report is recorded in the audit log.',
    cols: [['name', 'Student'], ['srn', 'SRN'], ['department', 'Department'], ['year', 'Year'], ['sessions', 'Sessions'], ['hours', 'Hours'], ['lateReturns', 'Late returns']] },
  { key: 'departments', label: 'Departments', about: 'Usage grouped by department and year.',
    cols: [['department', 'Department'], ['year', 'Year'], ['students', 'Students'], ['sessions', 'Sessions'], ['hours', 'Hours']] },
  { key: 'peak-hours', label: 'Peak hours', about: 'At which hour of the day students ask for equipment.', chart: true,
    cols: [['label', 'Hour'], ['requests', 'Requests']] },
];

const SUMMARY_LABELS = {
  overallPercent: 'Overall utilization %', openHoursPerDay: 'Open hours per day', days: 'Days in range', units: 'Units counted',
  idleDays: 'Idle for (days)', idleUnits: 'Idle units', returns: 'Returns', lateReturns: 'Late returns',
  onTimePercent: 'On time %', avgLateMinutes: 'Average late (min)', busiestHour: 'Busiest hour',
};

const isoDay = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); };

function currentRole() {
  try { return JSON.parse(localStorage.getItem('user'))?.role || 'student'; } catch { return 'student'; }
}

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  return value;
}

export default function Reports() {
  const isAdmin = currentRole() === 'admin';
  const [active, setActive] = useState(REPORTS[0].key);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(daysAgo(0));
  const [idleDays, setIdleDays] = useState(30);
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [department, setDepartment] = useState('');
  const [types, setTypes] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const report = useMemo(() => REPORTS.find((r) => r.key === active), [active]);

  useEffect(() => {
    api.get('/equipment/types', { params: { limit: 200 } })
      .then((r) => setTypes(r.data.data || r.data.types || []))
      .catch(() => setTypes([]));
  }, []);

  const params = useCallback((extra = {}) => {
    const p = { ...extra };
    if (report.noRange) p.days = idleDays;
    else { p.from = from; p.to = to; }
    if (type) p.type = type;
    if (category.trim()) p.category = category.trim();
    if (department.trim()) p.department = department.trim();
    return p;
  }, [report, from, to, idleDays, type, category, department]);

  // load() always reads the newest filters through this ref, so Show report never uses old dates.
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const load = useCallback(async (pageNo = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await getReport(active, paramsRef.current({ page: pageNo, limit: 25 }));
      setData(res.data);
      setPage(pageNo);
    } catch (e) {
      setData(null);
      setError(e.response?.data?.message || 'Could not load this report.');
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => { load(1); }, [load]);

  const apply = (e) => { e.preventDefault(); load(1); };

  const csv = async () => {
    setError('');
    try { await downloadReportCsv(active, params()); }
    catch (e) { setError('Could not download the CSV. Please try again.'); }
  };

  const rows = data?.data || [];
  const pages = data?.pagination?.pages || 1;
  const maxRequests = Math.max(1, ...rows.map((r) => r.requests || 0));
  const summary = data?.summary && !Array.isArray(data.summary) ? Object.entries(data.summary).filter(([k, v]) => SUMMARY_LABELS[k] && v !== null) : [];

  return <div>
    <div className="page-head">
      <p className="page-eyebrow">Sports Room</p>
      <h1>Reports</h1>
      <p className="page-sub">{report.about}</p>
    </div>

    <div role="tablist" aria-label="Reports" style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
      {REPORTS.map((r) => <button key={r.key} type="button" role="tab" aria-selected={r.key === active}
        className={r.key === active ? '' : 'btn-secondary'} onClick={() => setActive(r.key)}>{r.label}</button>)}
    </div>

    <form className="card" onSubmit={apply} style={{padding:16,display:'grid',gap:12,gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',alignItems:'end',marginBottom:16}}>
      {report.noRange
        ? <label>Idle for at least (days)<input type="number" min="1" max="365" value={idleDays} onChange={(e) => setIdleDays(e.target.value)} /></label>
        : <>
            <label>From<input type="date" required value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
            <label>To<input type="date" required value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          </>}
      <label>Equipment
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All equipment</option>
          {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
      </label>
      <label>Category<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All categories" /></label>
      {!report.noRange && <label>Department<input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="All departments" /></label>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button type="submit" disabled={loading}>{loading ? 'Loading...' : 'Show report'}</button>
        {isAdmin && <button type="button" className="btn-secondary" onClick={csv} disabled={loading || !rows.length}>Download CSV</button>}
      </div>
    </form>

    {error && <p className="notice notice-error">{error}</p>}

    {summary.length > 0 && <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
      {summary.map(([k, v]) => <div key={k} className="card" style={{padding:12,minWidth:140}}>
        <small>{SUMMARY_LABELS[k]}</small><div><strong style={{fontSize:22}}>{String(v)}</strong></div>
      </div>)}
    </div>}

    {active === 'damage' && Array.isArray(data?.summary?.topUnits) && data.summary.topUnits.length > 0 &&
      <p className="card" style={{padding:12}}><strong>Most reported units:</strong>{' '}
        {data.summary.topUnits.map((u) => `${u.unitCode} (${u.reports})`).join(', ')}</p>}

    {!loading && data && !rows.length && <p>No data for this range. Try a longer range or remove a filter.</p>}

    {rows.length > 0 && <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',textAlign:'left'}}>
        <thead><tr>{report.cols.map(([k, label]) => <th key={k}>{label}</th>)}{report.chart && <th style={{width:'50%'}} aria-label="Chart" />}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>
            {report.cols.map(([k]) => <td key={k}>{formatCell(r[k])}</td>)}
            {report.chart && <td><div style={{height:12,width:`${(r.requests / maxRequests) * 100}%`,minWidth:r.requests ? 4 : 0,background:'currentColor',opacity:0.55,borderRadius:3}} /></td>}
          </tr>)}
        </tbody>
      </table>
    </div>}

    {pages > 1 && <div style={{display:'flex',gap:8,alignItems:'center',marginTop:12}}>
      <button type="button" className="btn-secondary" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button type="button" className="btn-secondary" disabled={page >= pages || loading} onClick={() => load(page + 1)}>Next</button>
    </div>}
  </div>;
}
