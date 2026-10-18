import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { issueEquipment, returnEquipment } from '../api/sessions';
import './Scan.css';

// QR mein JSON hai {equipmentId, name}. Agar plain text hai to wahi ID maan lo.
const extractId = (text) => {
  try {
    const data = JSON.parse(text);
    if (data.equipmentId) return data.equipmentId;
  } catch {
    /* JSON nahi hai, plain text hai */
  }
  return text.trim();
};

function Scan() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('issue');
  const [condition, setCondition] = useState('GOOD');
  const [manualId, setManualId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  // Item waiting for the staff member's confirmation: { equipmentId } or null
  const [pending, setPending] = useState(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const scannerRef = useRef(null);

  // Step 1 of 2: a scan (or typed ID) only ASKS for confirmation, nothing is saved yet
  const askConfirm = (equipmentId) => {
    setResult(null);
    setDescription('');
    setPending({ equipmentId });
  };

  const cancelConfirm = () => {
    setPending(null);
    setDescription('');
  };

  // Step 2 of 2: the staff member pressed Confirm, now call the backend
  const confirm = async () => {
    if (!pending || submitting) return;
    setSubmitting(true);
    try {
      const { equipmentId } = pending;
      const res =
        mode === 'issue'
          ? await issueEquipment(equipmentId)
          : await returnEquipment(
              equipmentId,
              condition,
              // The description only matters for damaged items
              condition === 'DAMAGED' ? description.trim() : undefined
            );
      const s = res.data.session;
      const detail =
        mode === 'issue'
          ? `${s.equipment.name} - return by ${new Date(s.dueAt).toLocaleTimeString()}`
          : `Used for ${s.durationMinutes} min. ` +
            (s.wasLate ? `Late by ${s.lateMinutes} min.` : 'Returned on time.');
      setResult({ ok: true, text: `${res.data.message}. ${detail}` });
      setManualId('');
    } catch (err) {
      setResult({ ok: false, text: err.response?.data?.message || 'Something went wrong' });
    } finally {
      setPending(null);
      setDescription('');
      setSubmitting(false);
    }
  };

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

  const startScan = async () => {
    setResult(null);

    // 1. Pehle camera ka dabba screen par dikhao. Library dabbe ki chaudai naapti hai,
    //    aur chhupe hue dabbe ki chaudai 0 hoti hai, isliye feed gayab ho jaati thi.
    setScanning(true);

    // 2. Browser ko ek baar dabba draw karne do, phir camera shuru karo
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
      const scanner = new Html5Qrcode('reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          // scan wala chaukor dabbe ke 70% jitna, chhoti screen par bhi fit hota hai
          qrbox: (width, height) => {
            const side = Math.floor(Math.min(width, height) * 0.7);
            return { width: side, height: side };
          }
        },
        async (decodedText) => {
          if (!scannerRef.current) return; // pehle hi ek scan ho chuka hai
          await stopScan();
          askConfirm(extractId(decodedText));
        }
      );
    } catch (err) {
      scannerRef.current = null;
      setScanning(false);
      setResult({
        ok: false,
        text: `Could not start the camera (${err?.message || err}). Allow camera permission, or type the ID.`
      });
    }
  };

  // Escape key closes the confirm popup
  useEffect(() => {
    if (!pending) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) cancelConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, submitting]);

  // Page chhodte waqt camera band ho jaye
  useEffect(() => {
    return () => {
      stopScan();
    };
  }, []);

  const handleManual = (e) => {
    e.preventDefault();
    if (manualId.trim()) askConfirm(manualId.trim());
  };

  return (
    <>
      <div className="scan-head">
        <p className="scan-eyebrow">Quick action</p>
        <h1>Scan equipment QR</h1>
        <p className="scan-sub">Scan the QR sticker on an item to issue it, or to return it.</p>
      </div>

      <div className="scan-controls">
        <div className="seg" role="group" aria-label="Action">
          <button
            type="button"
            className={mode === 'issue' ? 'seg-on' : ''}
            aria-pressed={mode === 'issue'}
            onClick={() => { setMode('issue'); cancelConfirm(); }}
          >
            Issue
          </button>
          <button
            type="button"
            className={mode === 'return' ? 'seg-on' : ''}
            aria-pressed={mode === 'return'}
            onClick={() => { setMode('return'); cancelConfirm(); }}
          >
            Return
          </button>
        </div>

        {mode === 'return' && (
          <label className="field scan-condition">
            <span>Condition of the item</span>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="EXCELLENT">Excellent</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </label>
        )}
      </div>

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
            <h2 id="scan-camera-title">{scanning ? 'Scanning...' : 'Ready to scan'}</h2>
            <p className="scan-hint">
              {scanning
                ? 'Hold the QR sticker steady inside the box.'
                : 'Allow camera access and point it at the QR sticker on the item.'}
            </p>
          </div>

          {!scanning ? (
            <button className="btn-block" onClick={startScan}>Open camera scanner</button>
          ) : (
            <button className="btn-secondary btn-block" onClick={stopScan}>Stop camera</button>
          )}
        </section>

        <form onSubmit={handleManual} className="card scan-card" aria-labelledby="scan-manual-title">
          <div className="scan-card-text">
            <h2 id="scan-manual-title">Manual entry</h2>
            <p className="scan-hint">No camera? Type the equipment ID printed on the item.</p>
          </div>
          <label className="field">
            <span>Equipment ID</span>
            <input
              placeholder="e.g. FB-001"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-block" disabled={!manualId.trim()}>
            {mode === 'issue' ? 'Issue item' : 'Return item'}
          </button>
        </form>
      </div>

      {pending && (
        // Dark backdrop covers the page; clicking outside the card cancels
        <div className="scan-modal-backdrop" onClick={() => !submitting && cancelConfirm()}>
        <section
          className="card scan-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="scan-confirm-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="scan-confirm-title">
            {mode === 'issue' ? 'Issue this item?' : 'Return this item?'}
          </h2>
          <p className="scan-confirm-id">{pending.equipmentId}</p>
          {mode === 'return' && (
            <p className="scan-hint">
              Condition: <strong>{condition.charAt(0) + condition.slice(1).toLowerCase()}</strong>
            </p>
          )}

          {mode === 'return' && condition === 'DAMAGED' && (
            <label className="field">
              <span>What is damaged? (optional)</span>
              <textarea
                rows={3}
                maxLength={1000}
                placeholder="e.g. Handle cracked, net torn on one side"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          )}

          <div className="scan-confirm-actions">
            <button type="button" onClick={confirm} disabled={submitting}>
              {submitting ? 'Saving...' : 'Confirm'}
            </button>
            <button type="button" className="btn-secondary" onClick={cancelConfirm} disabled={submitting}>
              Cancel
            </button>
          </div>
        </section>
        </div>
      )}

      {result && (
        <p className={`notice scan-result ${result.ok ? 'notice-ok' : 'notice-error'}`} role="status">
          {result.text}
        </p>
      )}

      <button
        type="button"
        className="btn-ghost scan-report"
        onClick={() =>
          navigate(manualId.trim() ? `/report-damage?id=${encodeURIComponent(manualId.trim())}` : '/report-damage')
        }
      >
        Item broken or missing? Report it
      </button>
    </>
  );
}

export default Scan;
