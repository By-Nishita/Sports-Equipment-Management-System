import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getMyProfile, updateMyProfile, uploadMyPhoto } from '../api/users';
import './Profile.css';

const ROLE_LABEL = { student: 'Student', staff: 'Sports staff', admin: 'Admin' };
const MAX_PHOTO_MB = 5; // the backend refuses bigger files too

function initialsOf(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

// Read-only line: label on top, value below
function Fact({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Profile() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null); // { ok, text }
  const fileInput = useRef(null);

  useEffect(() => {
    getMyProfile()
      .then((res) => {
        setProfile(res.data.data.user);
        setStats(res.data.data.stats);
        setPhone(res.data.data.user.phone || '');
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load your profile. Please try again.'));
  }, []);

  const savePhone = async (e) => {
    e.preventDefault();
    setSavingPhone(true);
    setNotice(null);
    try {
      const res = await updateMyProfile({ phone });
      setProfile((old) => ({ ...old, ...res.data.data }));
      setPhone(res.data.data.phone || '');
      setNotice({ ok: true, text: res.data.message });
    } catch (err) {
      setNotice({ ok: false, text: err.response?.data?.message || 'Could not save. Please try again.' });
    } finally {
      setSavingPhone(false);
    }
  };

  const choosePhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // so choosing the same file again still fires
    if (!file) return;
    setNotice(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setNotice({ ok: false, text: 'Choose a JPG, PNG or WebP picture.' });
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setNotice({ ok: false, text: `The picture must be ${MAX_PHOTO_MB} MB or smaller.` });
      return;
    }
    setUploading(true);
    try {
      const res = await uploadMyPhoto(file);
      setProfile((old) => ({ ...old, ...res.data.data }));
      setNotice({ ok: true, text: res.data.message });
    } catch (err) {
      setNotice({ ok: false, text: err.response?.data?.message || 'Could not upload the picture. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  if (error) return <p className="notice notice-error" role="alert">{error}</p>;
  if (!profile) return <p className="pf-empty">Loading...</p>;

  const phoneChanged = phone.trim() !== (profile.phone || '');

  return (
    <>
      <div className="page-head">
        <p className="page-eyebrow">{ROLE_LABEL[profile.role] || profile.role}</p>
        <h1>My profile</h1>
        <p className="page-sub">Your details come from college records. You can change your phone and picture.</p>
      </div>

      {notice && (
        <p className={`notice ${notice.ok ? 'notice-ok' : 'notice-error'}`} role="status">
          {notice.text}
        </p>
      )}

      <div className="pf-body">
        <section className="card pf-card" aria-label="Details">
          <div className="pf-top">
            {profile.photoUrl ? (
              <img className="pf-photo" src={profile.photoUrl} alt="Your profile" />
            ) : (
              <span className="pf-photo pf-photo-letters" aria-hidden="true">{initialsOf(profile.name)}</span>
            )}
            <div>
              <h2 className="pf-name">{profile.name}</h2>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="pf-file"
                aria-label="Choose a picture"
                onChange={choosePhoto}
              />
              <button type="button" className="btn-secondary" disabled={uploading} onClick={() => fileInput.current.click()}>
                {uploading ? 'Uploading...' : profile.photoUrl ? 'Change picture' : 'Add a picture'}
              </button>
            </div>
          </div>

          <dl className="pf-facts">
            <Fact label="SRN" value={profile.srn} />
            <Fact label="Email" value={profile.email} />
            <Fact label="Department" value={profile.department} />
            <Fact label="Program" value={profile.program} />
            <Fact label="Division" value={profile.division} />
            <Fact label="Year" value={profile.year} />
          </dl>

          <form onSubmit={savePhone} className="pf-phone">
            <label className="field">
              <span>Phone number</span>
              <input
                type="tel"
                inputMode="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                maxLength={20}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <button type="submit" disabled={savingPhone || !phoneChanged}>
              {savingPhone ? 'Saving...' : 'Save phone'}
            </button>
          </form>

          <p className="pf-pass">
            <Link to="/change-password">Change password</Link>
          </p>
        </section>

        {stats && (
          <section aria-labelledby="pf-stats">
            <h2 id="pf-stats">Your numbers</h2>
            <div className="pf-stats">
              <div className="card pf-stat">
                <strong>{stats.totalSessions}</strong>
                <span>Items used</span>
              </div>
              <div className="card pf-stat">
                <strong>{stats.totalHours}</strong>
                <span>Hours</span>
              </div>
              <div className="card pf-stat">
                <strong>{stats.onTimePercent === null ? '-' : `${stats.onTimePercent}%`}</strong>
                <span>Returned on time</span>
              </div>
              <div className="card pf-stat">
                <strong>{stats.itemsHeldNow}</strong>
                <span>Holding now</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

export default Profile;
