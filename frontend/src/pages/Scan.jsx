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

  const scannerRef = useRef(null);
  const busyRef = useRef(false);

  // Camera ka callback purani mode/condition yaad rakhta hai,
  // isliye latest values ref mein rakhte hain
  const latest = useRef({ mode, condition });
  latest.current = { mode, condition };

  const submit = async (equipmentId) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const { mode, condition } = latest.current;
      const res =
        mode === 'issue'
          ? await issueEquipment(equipmentId)
          : await returnEquipment(equipmentId, condition);
      const s = res.data.session;
      const detail =
        mode === 'issue'
          ? `${s.equipment.name} - return by ${new Date(s.dueAt).toLocaleTimeString()}`
          : `Used for ${s.durationMinutes} min`;
      setResult({ ok: true, text: `${res.data.message}. ${detail}` });
    } catch (err) {
      setResult({ ok: false, text: err.response?.data?.message || 'Something went wrong' });
    } finally {
      busyRef.current = false;
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
    try {
      const scanner = new Html5Qrcode('reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          if (!scannerRef.current) return; // pehle hi ek scan ho chuka hai
          await stopScan();
          submit(extractId(decodedText));
        }
      );
      setScanning(true);
    } catch {
      scannerRef.current = null;
      setResult({ ok: false, text: 'Could not start the camera. Allow camera permission, or type the ID below.' });
    }
  };

  // Page chhodte waqt camera band ho jaye
  useEffect(() => {
    return () => {
      stopScan();
    };
  }, []);

  const handleManual = (e) => {
    e.preventDefault();
    if (manualId.trim()) submit(manualId.trim());
  };

  return (
    <div className="scan-page">
      <header className="topbar">
        <button className="btn-ghost" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
          &larr; Back
        </button>
        <h1>Scan equipment</h1>
      </header>

      <main className="scan-body">
        <div className="seg" role="group" aria-label="Action">
          <button
            type="button"
            className={mode === 'issue' ? 'seg-on' : ''}
            aria-pressed={mode === 'issue'}
            onClick={() => setMode('issue')}
          >
            Issue
          </button>
          <button
            type="button"
            className={mode === 'return' ? 'seg-on' : ''}
            aria-pressed={mode === 'return'}
            onClick={() => setMode('return')}
          >
            Return
          </button>
        </div>

        {mode === 'return' && (
          <label className="field">
            <span>Condition of the item</span>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="EXCELLENT">Excellent</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </label>
        )}

        <div className="card scan-camera">
          <div id="reader" className={scanning ? 'reader reader-live' : 'reader'}></div>
          {!scanning && <p className="scan-hint">Point the camera at the QR sticker on the item.</p>}
          {!scanning ? (
            <button className="btn-block" onClick={startScan}>Start camera</button>
          ) : (
            <button className="btn-secondary btn-block" onClick={stopScan}>Stop camera</button>
          )}
        </div>

        <form onSubmit={handleManual} className="card scan-manual">
          <label className="field">
            <span>No camera? Type the equipment ID</span>
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

        {result && (
          <p className={`notice ${result.ok ? 'notice-ok' : 'notice-error'}`} role="status">
            {result.text}
          </p>
        )}
      </main>
    </div>
  );
}

export default Scan;
