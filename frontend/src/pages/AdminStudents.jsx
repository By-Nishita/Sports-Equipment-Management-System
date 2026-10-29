import { useState, useEffect, useRef } from 'react';
import { getUsers, issueTempPassword, updateUser, dryRunImport, runImport } from '../api/users';
import './AdminStudents.css';

const ROLE_FILTERS = [
  { value: '', label: 'Everyone' },
  { value: 'student', label: 'Students' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admins' }
];

const TEMPLATE =
  'SRN,Name,Email,Department,Program,Division,Year\n' +
  '31240001,Example Student,example.student@college.edu,Computer Science,B.Tech,A,2\n';

// ------------------------------------------------------------------ CSV import
function ImportPanel({ onImported }) {
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [check, setCheck] = useState(null); // the dry-run answer
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  const reset = () => {
    setFile(null);
    setCheck(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const choose = (e) => {
    setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null);
    setCheck(null);
    setMessage(null);
  };

  const failText = (err, fallback) => err.response?.data?.message || fallback;

  const checkFile = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await dryRunImport(file);
      setCheck(res.data.data);
    } catch (err) {
      setCheck(null);
      setMessage({ ok: false, text: failText(err, 'Could not check the file. Please try again.') });
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await runImport(file);
      const r = res.data.data;
      setMessage({
        ok: r.failed === 0,
        text: `Done: ${r.created} new, ${r.updated} updated, ${r.invalidCount} skipped as invalid` +
          (r.failed ? `, ${r.failed} could not be saved` : '') + '.'
      });
      reset();
      onImported();
    } catch (err) {
      setMessage({ ok: false, text: failText(err, 'The import failed. Please try again.') });
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card st-import" aria-labelledby="st-import-title">
      <h2 id="st-import-title">Import students (CSV)</h2>
      <p className="st-note">
        Columns: SRN, Name, Email, Department, Program, Division, Year (SRN, Name and Email are required).
        Students already in the system are updated. New students set their own password with
        &ldquo;Forgot password&rdquo; (SRN or email).
      </p>

      <div className="st-import-row">
        <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={choose} aria-label="Choose a CSV file" />
        <button type="button" className="btn-secondary" onClick={downloadTemplate}>Download template</button>
        <button type="button" disabled={!file || busy} onClick={checkFile}>
          {busy && !check ? 'Checking...' : 'Check file'}
        </button>
      </div>

      {message && (
        <p className={`notice ${message.ok ? 'notice-ok' : 'notice-error'}`} role="status">{message.text}</p>
      )}

      {check && (
        <div className="st-check">
          <div className="st-counts">
            <div><strong>{check.totalRows}</strong><span>Rows</span></div>
            <div><strong>{check.willCreate}</strong><span>New</span></div>
            <div><strong>{check.willUpdate}</strong><span>Updated</span></div>
            <div className={check.invalidCount ? 'st-bad' : ''}><strong>{check.invalidCount}</strong><span>Invalid</span></div>
            <div className={check.duplicateCount ? 'st-bad' : ''}><strong>{check.duplicateCount}</strong><span>Duplicates</span></div>
          </div>

          {check.invalidCount > 0 && (
            <>
              <h3>Invalid rows (skipped)</h3>
              <ul className="st-problems">
                {check.invalid.map((r) => (
                  <li key={`i${r.line}`}>Line {r.line}{r.srn ? ` (${r.srn})` : ''}: {r.errors.join('; ')}</li>
                ))}
              </ul>
              {check.invalidCount > check.invalid.length && (
                <p className="st-note">Showing the first {check.invalid.length} of {check.invalidCount}.</p>
              )}
            </>
          )}
          {check.duplicateCount > 0 && (
            <>
              <h3>Duplicates in the file (skipped)</h3>
              <ul className="st-problems">
                {check.duplicates.map((r) => (
                  <li key={`d${r.line}`}>Line {r.line} ({r.srn}): {r.reason}</li>
                ))}
              </ul>
            </>
          )}

          <div className="st-import-row">
            <button type="button" disabled={busy || check.valid === 0} onClick={doImport}>
              {busy ? 'Importing...' : `Import ${check.valid} student${check.valid === 1 ? '' : 's'}`}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={reset}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ people list
function AdminStudents() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');         // what is typed
  const [applied, setApplied] = useState('');       // what is searched
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);       // { ok, text } after an action
  const [temp, setTemp] = useState(null);           // { name, password } shown once
  const [busyId, setBusyId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getUsers({ page, search: applied || undefined, role: role || undefined })
      .then((res) => {
        if (cancelled) return;
        setUsers(res.data.users);
        setPages(res.data.pages || 1);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load users.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, applied, role, reloadKey]);

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(search.trim());
  };

  const makeTemp = async (user) => {
    if (!window.confirm(`Create a temporary password for ${user.name}? Their old password will stop working.`)) return;
    setError('');
    setNotice(null);
    setTemp(null);
    try {
      const res = await issueTempPassword(user._id);
      setTemp({ name: user.name, password: res.data.tempPassword });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the password.');
    }
  };

  const change = async (user, body, question) => {
    if (!window.confirm(question)) return;
    setBusyId(user._id);
    setTemp(null);
    setNotice(null);
    try {
      await updateUser(user._id, body);
      setNotice({ ok: true, text: `${user.name} updated.` });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setNotice({ ok: false, text: err.response?.data?.message || 'Could not update this account.' });
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">Administration</p>
        <h1>Students and staff</h1>
        <p className="page-sub">
          Import students, search a person, close an account or make someone staff. If an email did not
          arrive, check their ID card and give a temporary password.
        </p>
      </div>

      <ImportPanel onImported={() => setReloadKey((k) => k + 1)} />

      <form className="st-search" onSubmit={applySearch}>
        <input type="text" placeholder="Search name, SRN or email" value={search}
          onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        <select aria-label="Show" value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }}>
          {ROLE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button type="submit">Search</button>
      </form>

      {notice && <p className={`notice ${notice.ok ? 'notice-ok' : 'notice-error'}`} role="status">{notice.text}</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {temp && (
        <div className="notice notice-warn" role="status">
          Temporary password for <strong>{temp.name}</strong>: <code className="st-temp">{temp.password}</code>
          <br />Tell it to the student in person. It is shown only once, and they must change it at first login.
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : users.length === 0 && !error ? (
        <p>No users found.</p>
      ) : (
        <div className="card st-wrap">
          <table className="st-table">
            <thead>
              <tr><th>Name</th><th>SRN</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.srn || '-'}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.isActive === false ? 'Closed' : u.mustChangePassword ? 'Must change password' : 'Active'}</td>
                  <td className="st-actions">
                    {u.role !== 'admin' && (
                      <>
                        <button type="button" className="btn-secondary" disabled={busyId === u._id} onClick={() => makeTemp(u)}>
                          Temporary password
                        </button>
                        {u.role === 'student' ? (
                          <button type="button" className="btn-secondary" disabled={busyId === u._id}
                            onClick={() => change(u, { role: 'staff' }, `Make ${u.name} a staff member? They will see the staff desk.`)}>
                            Make staff
                          </button>
                        ) : (
                          <button type="button" className="btn-secondary" disabled={busyId === u._id}
                            onClick={() => change(u, { role: 'student' }, `Make ${u.name} a student again?`)}>
                            Make student
                          </button>
                        )}
                        {u.isActive === false ? (
                          <button type="button" className="btn-secondary" disabled={busyId === u._id}
                            onClick={() => change(u, { isActive: true }, `Reopen the account of ${u.name}?`)}>
                            Reopen
                          </button>
                        ) : (
                          <button type="button" className="btn-secondary" disabled={busyId === u._id}
                            onClick={() => change(u, { isActive: false }, `Close the account of ${u.name}? They cannot log in, but their history stays.`)}>
                            Close account
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="st-pager">
        <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </>
  );
}

export default AdminStudents;
