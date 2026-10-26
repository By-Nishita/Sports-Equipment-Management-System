import { useState, useEffect } from 'react';
import { getUsers, issueTempPassword } from '../api/users';
import './AdminStudents.css';

function AdminStudents() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');         // what is typed
  const [applied, setApplied] = useState('');       // what is searched
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [temp, setTemp] = useState(null);           // { name, password } shown once

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getUsers({ page, search: applied || undefined })
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
  }, [page, applied]);

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(search.trim());
  };

  const makeTemp = async (user) => {
    if (!window.confirm(`Create a temporary password for ${user.name}? Their old password will stop working.`)) return;
    setError('');
    setTemp(null);
    try {
      const res = await issueTempPassword(user._id);
      setTemp({ name: user.name, password: res.data.tempPassword });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the password.');
    }
  };

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">Administration</p>
        <h1>Students and staff</h1>
        <p className="page-sub">Search a person. If their email did not arrive, check their ID card and give a temporary password.</p>
      </div>

      <form className="st-search" onSubmit={applySearch}>
        <input type="text" placeholder="Search name, SRN or email" value={search}
          onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        <button type="submit">Search</button>
      </form>

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
                  <td>
                    {u.role !== 'admin' && (
                      <button type="button" className="btn-secondary" onClick={() => makeTemp(u)}>Temporary password</button>
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