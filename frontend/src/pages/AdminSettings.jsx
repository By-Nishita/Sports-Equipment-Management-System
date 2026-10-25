import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../api/settings';
import './AdminSettings.css';

// One row per setting: database key, label, help text, allowed range.
const FIELDS = [
  { key: 'defaultIssueHours', label: 'Default issue time (hours)', help: 'How long a student may keep an item before it is overdue.', min: 0.5, max: 12, step: 0.5 },
  { key: 'graceMinutes', label: 'Grace time (minutes)', help: 'Extra minutes after the due time before a return counts as late.', min: 0, max: 120, step: 1 },
  { key: 'approvalTimeoutMinutes', label: 'Approval timeout (minutes)', help: 'If staff does not approve within this time, the request expires.', min: 1, max: 120, step: 1 },
  { key: 'maxItemsPerStudent', label: 'Max items per student', help: 'How many items one student can hold at the same time.', min: 1, max: 20, step: 1 },
  { key: 'openingHour', label: 'Counter opens (hour, 0-23)', help: 'Used by the utilization report.', min: 0, max: 23, step: 1 },
  { key: 'closingHour', label: 'Counter closes (hour, 1-24)', help: 'Used by the utilization report.', min: 1, max: 24, step: 1 }
];

function AdminSettings() {
  const [values, setValues] = useState(null); // null until loaded
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then((res) => setValues(res.data.settings))
      .catch((err) => setError(err.response?.data?.message || 'Could not load settings.'));
  }, []);

  const change = (key, value) => {
    setNotice('');
    setValues((v) => ({ ...v, [key]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const body = {};
      FIELDS.forEach((f) => (body[f.key] = Number(values[f.key])));
      const res = await saveSettings(body);
      setValues(res.data.settings);
      setNotice('Settings saved.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">Administration</p>
        <h1>Settings</h1>
        <p className="page-sub">Rules for issue time, late returns and limits. Changes apply to new requests.</p>
      </div>

      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {notice && <p className="notice notice-ok" role="status">{notice}</p>}

      {!values ? (
        !error && <p>Loading...</p>
      ) : (
        <form className="card as-form" onSubmit={submit}>
          {FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                type="number"
                min={f.min}
                max={f.max}
                step={f.step}
                value={values[f.key]}
                onChange={(e) => change(f.key, e.target.value)}
                required
              />
              <small className="as-help">{f.help}</small>
            </div>
          ))}
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</button>
        </form>
      )}
    </>
  );
}

export default AdminSettings;
