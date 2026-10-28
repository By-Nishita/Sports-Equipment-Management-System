import { useEffect, useState } from 'react';
import api from '../api/axios';

function StaffStockCount() {
  const [audits, setAudits] = useState([]);
  const [auditId, setAuditId] = useState('');
  const [auditData, setAuditData] = useState(null);
  const [unitCode, setUnitCode] = useState('');
  const [condition, setCondition] = useState('GOOD');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadAudits();
  }, []);

  const loadAudits = async () => {
    try {
      setError('');

      const response = await api.get('/stock-audits');
      const activeAudits = (Array.isArray(response.data) ? response.data : [])
        .filter((audit) => audit.status === 'IN_PROGRESS');

      setAudits(activeAudits);

      if (activeAudits.length > 0) {
        setAuditId((currentId) =>
          activeAudits.some((audit) => audit._id === currentId)
            ? currentId
            : activeAudits[0]._id
        );
      } else {
        setAuditId('');
        setAuditData(null);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Could not load active stock audits.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadAuditDetails = async (id) => {
    if (!id) {
      setAuditData(null);
      return;
    }

    try {
      setError('');
      const response = await api.get(`/stock-audits/${id}`);
      setAuditData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Could not load audit details.'
      );
    }
  };

  useEffect(() => {
    loadAuditDetails(auditId);
  }, [auditId]);

  const scanUnit = async (event) => {
    event.preventDefault();

    if (!auditId || !unitCode.trim()) {
      setError('Select an active audit and enter a unit code.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      setSuccess('');

      const response = await api.post(`/stock-audits/${auditId}/scan`, {
        unitCode: unitCode.trim().toUpperCase(),
        actualCondition: condition,
        remarks: remarks.trim(),
      });

      const item = response.data.item;

      if (item?.verificationStatus === 'UNEXPECTED') {
        setSuccess(
          `Unit ${item.unitCode} recorded as UNEXPECTED. Please verify its identity.`
        );
      } else {
        setSuccess(`Unit ${item?.unitCode || unitCode} verified successfully.`);
      }

      setUnitCode('');
      setRemarks('');
      await loadAuditDetails(auditId);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not verify this unit.');
    } finally {
      setBusy(false);
    }
  };

  const items = auditData?.items || [];
  const found = items.filter(
    (item) => item.verificationStatus === 'FOUND'
  ).length;
  const unexpected = items.filter(
    (item) => item.verificationStatus === 'UNEXPECTED'
  ).length;
  const pending = items.filter(
    (item) => item.verificationStatus === 'NOT_CHECKED'
  ).length;
  const total = items.length;

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <p className="page-eyebrow">STOCK VERIFICATION</p>
          <h1>Staff Stock Count</h1>
          <p className="page-sub">
            Select an active audit, verify equipment units and record their
            physical condition.
          </p>
        </div>
      </header>

      {error && <div className="notice notice-error">{error}</div>}
      {success && <div className="notice notice-ok">{success}</div>}

      {loading ? (
        <section className="card">
          <p>Loading active audits...</p>
        </section>
      ) : audits.length === 0 ? (
        <section className="card">
          <h2>No active stock audit</h2>
          <p>
            There is no stock audit in progress. Please ask an administrator
            to start one.
          </p>
          <button type="button" onClick={loadAudits}>
            Refresh
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>Select active audit</h2>

            <select
              value={auditId}
              onChange={(event) => setAuditId(event.target.value)}
              aria-label="Select stock audit"
              style={{
                width: '100%',
                maxWidth: 500,
                padding: 12,
                border: '1px solid #ccc',
                borderRadius: 8,
              }}
            >
              {audits.map((audit) => (
                <option key={audit._id} value={audit._id}>
                  {audit.name}
                </option>
              ))}
            </select>

            {auditData?.audit && (
              <p className="page-sub" style={{ marginTop: 12 }}>
                Status: {auditData.audit.status.replaceAll('_', ' ')}
              </p>
            )}
          </section>

          <section className="card" style={{ marginTop: 20 }}>
            <h2>Verify equipment</h2>
            <p className="page-sub">
              Enter the unit code printed on the equipment label or QR tag.
            </p>

            <form onSubmit={scanUnit}>
              <label
                htmlFor="stock-unit-code"
                style={{ display: 'block', marginBottom: 6 }}
              >
                Unit Code
              </label>

              <input
                id="stock-unit-code"
                value={unitCode}
                onChange={(event) => setUnitCode(event.target.value)}
                placeholder="e.g. BAT-001"
                autoComplete="off"
                required
                style={{
                  width: '100%',
                  maxWidth: 500,
                  boxSizing: 'border-box',
                  padding: 12,
                  border: '1px solid #ccc',
                  borderRadius: 8,
                }}
              />

              <label
                htmlFor="stock-condition"
                style={{ display: 'block', marginTop: 16, marginBottom: 6 }}
              >
                Observed Condition
              </label>

              <select
                id="stock-condition"
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
                style={{
                  width: '100%',
                  maxWidth: 500,
                  padding: 12,
                  border: '1px solid #ccc',
                  borderRadius: 8,
                }}
              >
                <option value="EXCELLENT">Excellent</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="DAMAGED">Damaged</option>
              </select>

              <label
                htmlFor="stock-remarks"
                style={{ display: 'block', marginTop: 16, marginBottom: 6 }}
              >
                Remarks (optional)
              </label>

              <textarea
                id="stock-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Describe any visible damage or other observations"
                rows={3}
                maxLength={1000}
                style={{
                  width: '100%',
                  maxWidth: 500,
                  boxSizing: 'border-box',
                  padding: 12,
                  border: '1px solid #ccc',
                  borderRadius: 8,
                  display: 'block',
                }}
              />

              <button
                type="submit"
                disabled={busy || !auditId}
                style={{ marginTop: 16 }}
              >
                {busy ? 'Saving...' : 'Verify Unit'}
              </button>
            </form>
          </section>

          <section className="card" style={{ marginTop: 20 }}>
            <h2>Verification Progress</h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 12,
              }}
            >
              <ProgressCard label="Total Units" value={total} />
              <ProgressCard label="Found" value={found} />
              <ProgressCard label="Pending" value={pending} />
              <ProgressCard label="Unexpected" value={unexpected} />
            </div>

            <div
              style={{
                height: 10,
                background: '#e5e7eb',
                borderRadius: 10,
                overflow: 'hidden',
                marginTop: 20,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${total ? (found / total) * 100 : 0}%`,
                  background: '#16a34a',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>

            <p className="page-sub">
              {total ? Math.round((found / total) * 100) : 0}% of expected
              units verified as found.
            </p>
          </section>

          <section className="card" style={{ marginTop: 20 }}>
            <h2>Recently Recorded Units</h2>

            {!items.length ? (
              <p>No units recorded yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={cellStyle}>Unit Code</th>
                      <th style={cellStyle}>Verification</th>
                      <th style={cellStyle}>Condition</th>
                      <th style={cellStyle}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...items]
                      .filter(
                        (item) =>
                          item.verificationStatus !== 'NOT_CHECKED'
                      )
                      .sort(
                        (a, b) =>
                          new Date(b.verifiedAt || 0) -
                          new Date(a.verifiedAt || 0)
                      )
                      .map((item) => (
                        <tr key={item._id}>
                          <td style={cellStyle}>{item.unitCode}</td>
                          <td style={cellStyle}>
                            {item.verificationStatus?.replaceAll('_', ' ')}
                          </td>
                          <td style={cellStyle}>
                            {item.actualCondition || '—'}
                          </td>
                          <td style={cellStyle}>{item.remarks || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function ProgressCard({ label, value }) {
  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: 10,
        padding: 16,
      }}
    >
      <p style={{ margin: 0, fontSize: 13 }}>{label}</p>
      <h2 style={{ margin: '8px 0 0' }}>{value}</h2>
    </div>
  );
}

const cellStyle = {
  textAlign: 'left',
  padding: '12px 10px',
  borderBottom: '1px solid #ddd',
  whiteSpace: 'nowrap',
};

export default StaffStockCount;