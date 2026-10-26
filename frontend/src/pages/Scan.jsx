import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { getTypes, getTypeByQr } from '../api/equipmentTypes';
import { requestIssue, cancelRequest, getMySessions } from '../api/sessions';
import TypeThumb from '../components/TypeThumb';
import usePolling from '../hooks/usePolling';
import { formatClock } from '../utils/time';
import './Scan.css';

// The QR sticker holds JSON like { "t": "TYPE-FOOTBALL" }. Plain text is accepted too.
const extractQr = (text) => {
  try {
    const data = JSON.parse(text);
    if (data && typeof data.t === 'string') return data.t.trim().toUpperCase();
  } catch {
    /* not JSON, so it is plain text */
  }
  return String(text).trim().toUpperCase();
};

const errorText = (err, fallback) => err.response?.data?.message || fallback;

// The student asks for an item. Staff then hands over a real unit and approves.
// Screens: choose the item -> confirm -> waiting for staff -> result.
function Scan() {
  const navigate = useNavigate();

  const [types, setTypes] = useState([]);
  const [typesError, setTypesError] = useState('');
  const [chosen, setChosen] = useState(null); // the type the student is about to request
  const [ack, setAck] = useState(false); // acknowledgement checkbox
  const [submitting, setSubmitting] = useState(false);
  const [waiting, setWaiting] = useState(null); // the ISSUE_PENDING session
  const [outcome, setOutcome] = useState(null); // { status, session } once the request is settled
  const [message, setMessage] = useState(null); // { ok, text }
  const [scanning, setScanning] = useState(false);

  const scannerRef = useRef(null);

  // When the page opens: load the item list, and resume a request that is already waiting
  useEffect(() => {
    let cancelled = false;
    getTypes({ limit: 100 })
      .then((res) => {
        if (!cancelled) setTypes(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) setTypesError(errorText(err, 'Could not load the equipment list.'));
      });
    getMySessions({ open: 'true' })
      .then((res) => {
        const pending = res.data.data.find((s) => s.status === 'ISSUE_PENDING');
        if (!cancelled && pending) setWaiting(pending);
      })
      .catch(() => {
        /* not important: the student can still make a new request */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // While a request is waiting, ask every 5 seconds what happened to it
  const checkWaiting = useCallback(async () => {
    if (!waiting) return;
    try {
      const res = await getMySessions({ limit: 10 });
      const fresh = res.data.data.find((s) => s._id === waiting._id);
      if (!fresh || fresh.status === 'ISSUE_PENDING') return;
      setWaiting(null);
      setOutcome({ status: fresh.status, session: fresh });
    } catch {
      /* network blip: keep waiting, the next round tries again */
    }
  }, [waiting]);
  usePolling(checkWaiting, 5000, Boolean(waiting));

  const choose = (type) => {
    setChosen(type);
    setAck(false);
    setMessage(null);
    setOutcome(null);
  };

  const backToList = () => {
    setChosen(null);
    setAck(false);
    setMessage(null);
    setOutcome(null);
  };

  const submit = async () => {
    if (!chosen || !ack || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await requestIssue(chosen._id, true);
      setWaiting(res.data.data);
    } catch (err) {
      setMessage({ ok: false, text: errorText(err, 'Could not send the request. Please try again.') });
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!waiting || submitting) return;
    setSubmitting(true);
    try {
      await cancelRequest(waiting._id);
      setWaiting(null);
      setOutcome({ status: 'CANCELLED', session: waiting });
    } catch (err) {
      // most likely staff approved it a moment ago: look again
      setMessage({ ok: false, text: errorText(err, 'This request cannot be cancelled.') });
      checkWaiting();
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- camera ----------
  const stopScan = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
    setScanning(false);
  };

  const handleScanned = async (text) => {
    try {
      const res = await getTypeByQr(extractQr(text));
      choose(res.data.data);
    } catch (err) {
      setMessage({
        ok: false,
        text: err.response?.status === 404 ? 'This QR is not an equipment sticker.' : errorText(err, 'Could not read this QR.')
      });
    }
  };

  const startScan = async () => {
    setMessage(null);
    // Show the camera box first: the library measures the box, and a hidden box has no size
    setScanning(true);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
      const scanner = new Html5Qrcode('reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (width, height) => {
            const side = Math.floor(Math.min(width, height) * 0.7);
            return { width: side, height: side };
          }
        },
        async (decodedText) => {
          if (!scannerRef.current) return; // already handled one scan
          await stopScan();
          handleScanned(decodedText);
        }
      );
    } catch (err) {
      scannerRef.current = null;
      setScanning(false);
      setMessage({
        ok: false,
        text: `Could not start the camera (${err?.message || err}). Allow camera permission, or choose the item from the list.`
      });
    }
  };

  // Turn the camera off when leaving the page
  useEffect(() => {
    return () => {
      stopScan();
    };
  }, []);

  const head = (
    <div className="scan-head">
      <p className="scan-eyebrow">Borrow equipment</p>
      <h1>Request an item</h1>
      <p className="scan-sub">Scan the QR sticker (or choose the item). Staff will hand you one and approve it.</p>
    </div>
  );

  // ---------- screen 4: result ----------
  if (outcome) {
    const { status, session } = outcome;
    const unitCode = session.unit?.unitCode;
    const typeName = session.type?.name || chosen?.name || 'the item';
    return (
      <>
        {head}
        <section className="card scan-state" aria-live="polite">
          {status === 'ACTIVE' && (
            <>
              <h2>Approved</h2>
              <p className="scan-big">{unitCode || typeName}</p>
              <p>
                Take <strong>{typeName}</strong> from staff. Return it by <strong>{formatClock(session.dueAt)}</strong>.
              </p>
              <div className="scan-actions">
                <button type="button" onClick={() => navigate('/my-use')}>Go to My Active Use</button>
              </div>
            </>
          )}
          {status === 'REJECTED' && (
            <>
              <h2>Request declined</h2>
              <p>
                Staff did not approve your request for {typeName}.
                {session.rejectReason ? ` Reason: ${session.rejectReason}` : ''}
              </p>
              <div className="scan-actions">
                <button type="button" onClick={backToList}>Request something else</button>
              </div>
            </>
          )}
          {status === 'EXPIRED' && (
            <>
              <h2>Request expired</h2>
              <p>Nobody approved your request in time. Please go to the counter and request again.</p>
              <div className="scan-actions">
                <button type="button" onClick={backToList}>Request again</button>
              </div>
            </>
          )}
          {status === 'CANCELLED' && (
            <>
              <h2>Request cancelled</h2>
              <div className="scan-actions">
                <button type="button" onClick={backToList}>Back</button>
              </div>
            </>
          )}
        </section>
      </>
    );
  }

  // ---------- screen 3: waiting for staff ----------
  if (waiting) {
    const waitingType = typeof waiting.type === 'object' && waiting.type ? waiting.type : chosen;
    return (
      <>
        {head}
        <section className="card scan-state" aria-live="polite">
          <div className="scan-state-top">
            <TypeThumb type={waitingType} size={72} />
            <div>
              <h2>Waiting for staff</h2>
              <p className="scan-hint">
                {waitingType?.name || 'Your item'}, requested at {formatClock(waiting.requestedAt)}
              </p>
            </div>
          </div>
          <p>
            Go to the staff counter. They will give you an item and approve your request. This page updates by itself.
          </p>
          <p className="scan-hint">If nobody approves it within a few minutes, the request expires.</p>
          {message && <p className="notice notice-error" role="alert">{message.text}</p>}
          <div className="scan-actions">
            <button type="button" className="btn-secondary" onClick={cancel} disabled={submitting}>
              Cancel request
            </button>
          </div>
        </section>
      </>
    );
  }

  // ---------- screen 2: confirm ----------
  if (chosen) {
    const available = chosen.counts?.available ?? 0;
    return (
      <>
        {head}
        <section className="card scan-state">
          <div className="scan-state-top">
            <TypeThumb type={chosen} size={96} />
            <div>
              <h2>{chosen.name}</h2>
              <p className="scan-hint">{[chosen.category, chosen.brand].filter(Boolean).join(' - ')}</p>
              <p className={available > 0 ? 'scan-avail' : 'scan-avail scan-avail-none'}>
                {available > 0 ? `${available} available` : 'None available right now'}
              </p>
            </div>
          </div>

          <label className="scan-ack">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>I will take care of this item and return it to the staff counter on time.</span>
          </label>

          {message && <p className="notice notice-error" role="alert">{message.text}</p>}

          <div className="scan-actions">
            <button type="button" onClick={submit} disabled={!ack || available < 1 || submitting}>
              {submitting ? 'Sending...' : 'Send request'}
            </button>
            <button type="button" className="btn-secondary" onClick={backToList} disabled={submitting}>
              Back
            </button>
          </div>
        </section>
      </>
    );
  }

  // ---------- screen 1: scan or choose ----------
  return (
    <>
      {head}

      {message && <p className={`notice scan-msg ${message.ok ? 'notice-ok' : 'notice-error'}`} role="status">{message.text}</p>}

      <div className="scan-grid">
        <section className="card scan-card" aria-labelledby="scan-camera-title">
          {!scanning && (
            <div className="scan-frame" aria-hidden="true">
              <span className="scan-corner scan-corner-tl" />
              <span className="scan-corner scan-corner-tr" />
              <span className="scan-corner scan-corner-bl" />
              <span className="scan-corner scan-corner-br" />
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3">
                <rect x="6" y="6" width="14" height="14" rx="2" />
                <rect x="28" y="6" width="14" height="14" rx="2" />
                <rect x="6" y="28" width="14" height="14" rx="2" />
                <path d="M28 28h5v5M42 28v14M28 38v4h5" />
              </svg>
            </div>
          )}
          <div id="reader" className={scanning ? 'reader reader-live' : 'reader'}></div>

          <div className="scan-card-text">
            <h2 id="scan-camera-title">{scanning ? 'Scanning...' : 'Scan the QR sticker'}</h2>
            <p className="scan-hint">
              {scanning
                ? 'Hold the QR sticker steady inside the box.'
                : 'The sticker is on the shelf or the box, one per kind of item.'}
            </p>
          </div>

          {!scanning ? (
            <button className="btn-block" onClick={startScan}>Open camera scanner</button>
          ) : (
            <button className="btn-secondary btn-block" onClick={stopScan}>Stop camera</button>
          )}
        </section>

        <section className="card scan-card" aria-labelledby="scan-list-title">
          <div className="scan-card-text">
            <h2 id="scan-list-title">Or choose the item</h2>
            <p className="scan-hint">No camera? Pick what you want to borrow.</p>
          </div>

          {typesError && <p className="notice notice-error" role="alert">{typesError}</p>}

          <ul className="scan-types">
            {types.map((t) => {
              const available = t.counts?.available ?? 0;
              return (
                <li key={t._id}>
                  <button
                    type="button"
                    className="scan-type btn-secondary"
                    onClick={() => choose(t)}
                    disabled={available < 1}
                  >
                    <TypeThumb type={t} size={44} />
                    <span className="scan-type-text">
                      <strong>{t.name}</strong>
                      <small>{available > 0 ? `${available} available` : 'None available'}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!typesError && types.length === 0 && <p className="scan-hint">No equipment has been added yet.</p>}
        </section>
      </div>

      <button type="button" className="btn-ghost scan-report" onClick={() => navigate('/report-damage')}>
        Item broken or missing? Report it
      </button>
    </>
  );
}

export default Scan;