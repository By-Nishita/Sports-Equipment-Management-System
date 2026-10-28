import { useEffect, useState } from 'react';
import api from '../api/axios';

function AdminStockAudit() {
  const [audits, setAudits] = useState([]);
  const [auditName, setAuditName] = useState('');
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAudits = async () => {
    try {
      setError('');
      const response = await api.get('/stock-audits');
      setAudits(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load stock audits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudits();
  }, []);

  const startAudit = async (event) => {
    event.preventDefault();

    if (!auditName.trim()) {
      setError('Please enter an audit name.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      setSuccess('');

      const response = await api.post('/stock-audits', {
        name: auditName.trim(),
      });

      setSuccess(
        `Stock audit started successfully. ${
          response.data.totalUnits ?? 0
        } units included.`
      );
      setAuditName('');
      await loadAudits();

      if (response.data.audit?._id) {
        await viewReport(response.data.audit._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start stock audit.');
    } finally {
      setBusy(false);
    }
  };

  const viewReport = async (auditId) => {
    try {
      setError('');
      setReport(null);
      setSelectedAudit(auditId);

      const response = await api.get(`/stock-audits/${auditId}/report`);
      setReport(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load audit report.');
    }
  };

  const closeAudit = async (auditId) => {
    try {
      setBusy(true);
      setError('');
      setSuccess('');

      const detailResponse = await api.get(`/stock-audits/${auditId}`);
      const items = detailResponse.data.items || [];
      const unchecked = items.filter(
        (item) => item.verificationStatus === 'NOT_CHECKED'
      );

      const confirmed = window.confirm(
        unchecked.length
          ? `This audit has ${unchecked.length} unchecked unit(s). You must resolve each as SEARCH AGAIN or LOST before closing. Continue?`
          : 'No unchecked units remain. Close this stock audit?'
      );

      if (!confirmed) return;

      const resolutions = [];

      for (const item of unchecked) {
        const choice = window.prompt(
          `Unit: ${item.unitCode}\nEnter 1 to SEARCH AGAIN\nEnter 2 to mark LOST\n\nCancel to stop closing the audit.`,
          '1'
        );

        if (choice === null) {
          setError('Audit was not closed. Resolution selection cancelled.');
          return;
        }

        const normalized = choice.trim().toUpperCase();
        let resolution;

        if (normalized === '1' || normalized === 'SEARCH_AGAIN') {
          resolution = 'SEARCH_AGAIN';
        } else if (normalized === '2' || normalized === 'LOST') {
          resolution = 'LOST';
        } else {
          setError(`Invalid choice for ${item.unitCode}. Enter 1 or 2. Audit remains open.`);
          return;
        }

        resolutions.push({ unitCode: item.unitCode, resolution });
      }

      await api.post(`/stock-audits/${auditId}/close`, { resolutions });

      setSuccess('Stock audit completed successfully.');
      await loadAudits();
      await viewReport(auditId);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not close stock audit.');
    } finally {
      setBusy(false);
    }
  };

  const summary = report?.summary;

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <p className="page-eyebrow">ADMINISTRATION</p>
          <h1>Stock Verification</h1>
          <p className="page-sub">
            Start physical stock audits, monitor verification progress and
            review discrepancies.
          </p>
        </div>
      </header>

      {error && <div className="notice notice-error">{error}</div>}
      {success && <div className="notice notice-ok">{success}</div>}

      <section className="card">
        <h2>Start a new stock audit</h2>
        <p className="page-sub">
          The system records the eligible equipment units and their expected
          status and condition when the audit starts.
        </p>

        <form onSubmit={startAudit}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={auditName}
              onChange={(event) => setAuditName(event.target.value)}
              placeholder="e.g. October 2026 Stock Audit"
              aria-label="Stock audit name"
              maxLength={120}
              required
              style={{
                flex: '1 1 260px',
                padding: '10px 12px',
                border: '1px solid #ccc',
                borderRadius: 8,
              }}
            />

            <button type="submit" disabled={busy}>
              {busy ? 'Please wait...' : 'Start Audit'}
            </button>
          </div>
        </form>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <h2>Stock Audits</h2>

        {loading ? (
          <p>Loading audits...</p>
        ) : audits.length === 0 ? (
          <p>No stock audits found. Start your first audit above.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={cellStyle}>Audit Name</th>
                  <th style={cellStyle}>Status</th>
                  <th style={cellStyle}>Started</th>
                  <th style={cellStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => (
                  <tr key={audit._id}>
                    <td style={cellStyle}>{audit.name}</td>
                    <td style={cellStyle}>
                      <span>{audit.status?.replaceAll('_', ' ')}</span>
                    </td>
                    <td style={cellStyle}>
                      {audit.startedAt
                        ? new Date(audit.startedAt).toLocaleString()
                        : '—'}
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => viewReport(audit._id)}
                        >
                          View Report
                        </button>

                        {audit.status === 'IN_PROGRESS' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => closeAudit(audit._id)}
                          >
                            Close Audit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {report && selectedAudit && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>{report.audit?.name || 'Audit Report'}</h2>
          <p className="page-sub">
            Status: {report.audit?.status?.replaceAll('_', ' ')}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 12,
              marginTop: 16,
            }}
          >
            <SummaryCard label="Total Units" value={summary?.total} />
            <SummaryCard label="Found" value={summary?.found} />
            <SummaryCard label="Missing" value={summary?.missing} />
            <SummaryCard label="Unexpected" value={summary?.unexpected} />
            <SummaryCard label="Damaged" value={summary?.damaged} />
            <SummaryCard label="Maintenance" value={summary?.maintenance} />
          </div>

          <h3 style={{ marginTop: 24 }}>Unit Details</h3>

          {!report.items?.length ? (
            <p>No units are recorded in this audit.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={cellStyle}>Unit Code</th>
                    <th style={cellStyle}>Expected Status</th>
                    <th style={cellStyle}>Expected Condition</th>
                    <th style={cellStyle}>Verification</th>
                    <th style={cellStyle}>Actual Condition</th>
                    <th style={cellStyle}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((item) => (
                    <tr key={item._id}>
                      <td style={cellStyle}>{item.unitCode}</td>
                      <td style={cellStyle}>{item.expectedStatus || '—'}</td>
                      <td style={cellStyle}>{item.expectedCondition || '—'}</td>
                      <td style={cellStyle}>
                        {item.verificationStatus?.replaceAll('_', ' ')}
                      </td>
                      <td style={cellStyle}>{item.actualCondition || '—'}</td>
                      <td style={cellStyle}>{item.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            style={{ marginTop: 16 }}
            onClick={() => {
              setReport(null);
              setSelectedAudit(null);
            }}
          >
            Hide Report
          </button>
        </section>
      )}
    </main>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: 10,
        padding: 16,
      }}
    >
      <p style={{ margin: 0, fontSize: 13 }}>{label}</p>
      <h2 style={{ margin: '8px 0 0' }}>{value ?? 0}</h2>
    </div>
  );
}

const cellStyle = {
  textAlign: 'left',
  padding: '12px 10px',
  borderBottom: '1px solid #ddd',
  whiteSpace: 'nowrap',
};

export default AdminStockAudit;