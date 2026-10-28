import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createDamageReport, getMyDamageReports } from '../api/damageReports';
import DamageReportRow from '../components/DamageReportRow';
import './ReportDamage.css';

const MIN_DESCRIPTION = 5; // the backend asks for the same

function ReportDamage() {
  const [searchParams] = useSearchParams();

  // Coming from "My Active Use", the unit ID is already filled in (?unit=FB-007)
  const [unitCode, setUnitCode] = useState((searchParams.get('unit') || '').toUpperCase());
  const [type, setType] = useState('DAMAGE');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const loadReports = useCallback(async () => {
    try {
      const res = await getMyDamageReports();
      setReports(res.data.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const trimmedLength = description.trim().length;
  const canSubmit = unitCode.trim() && trimmedLength >= MIN_DESCRIPTION && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await createDamageReport({ unitCode: unitCode.trim(), description: description.trim(), type });
      setResult({ ok: true, text: res.data.message });
      setDescription('');
      await loadReports();
    } catch (err) {
      setResult({
        ok: false,
        text: err.response?.data?.message || 'Could not send the report. Please try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rd-page">
      <div className="page-head">
        <p className="page-eyebrow">Problems</p>
        <h1>Report damage</h1>
        <p className="page-sub">Tell staff if an item is broken or lost. It stays out of use until they check it.</p>
      </div>

      <div className="rd-body">
        <form onSubmit={handleSubmit} className="card">
          <div className="seg" role="group" aria-label="What happened">
            <button
              type="button"
              className={type === 'DAMAGE' ? 'seg-on' : ''}
              aria-pressed={type === 'DAMAGE'}
              onClick={() => setType('DAMAGE')}
            >
              It is damaged
            </button>
            <button
              type="button"
              className={type === 'LOSS' ? 'seg-on' : ''}
              aria-pressed={type === 'LOSS'}
              onClick={() => setType('LOSS')}
            >
              It is lost
            </button>
          </div>

          <label className="field rd-field">
            <span>Unit ID (printed on the item)</span>
            <input
              placeholder="e.g. FB-007"
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value.toUpperCase())}
              maxLength={20}
              required
            />
          </label>

          <label className="field">
            <span>What happened?</span>
            <textarea
              rows={4}
              placeholder={type === 'LOSS' ? 'Where did you last have it?' : 'e.g. The seam on the football has split'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>
          <p className="rd-hint">
            {trimmedLength < MIN_DESCRIPTION
              ? `Write at least ${MIN_DESCRIPTION} characters.`
              : 'The item will be taken out of use until staff have checked it.'}
          </p>

          <button type="submit" className="btn-block" disabled={!canSubmit}>
            {submitting ? 'Sending...' : 'Send report'}
          </button>

          {result && (
            <p className={`notice rd-result ${result.ok ? 'notice-ok' : 'notice-error'}`} role="status">
              {result.text}
            </p>
          )}
        </form>

        <section aria-labelledby="my-reports">
          <h2 id="my-reports">Your reports</h2>

          {loadingReports ? (
            <p className="rd-empty">Loading...</p>
          ) : reports.length === 0 ? (
            <p className="rd-empty">You have not reported anything yet.</p>
          ) : (
            <ul className="rd-list">
              {reports.map((report) => (
                <DamageReportRow key={report._id} report={report} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default ReportDamage;
