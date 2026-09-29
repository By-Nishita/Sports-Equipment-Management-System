import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { issueEquipment, returnEquipment } from '../api/sessions';

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
      setResult({ ok: false, text: 'Camera start nahi hua. Permission allow karo ya neeche ID type karo.' });
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
    <div style={{ padding: '20px', maxWidth: '420px', margin: '0 auto' }}>
      <button onClick={() => navigate('/dashboard')}>&larr; Back</button>
      <h2>Scan Equipment</h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button
          onClick={() => setMode('issue')}
          style={{ fontWeight: mode === 'issue' ? 'bold' : 'normal' }}
        >
          Issue
        </button>
        <button
          onClick={() => setMode('return')}
          style={{ fontWeight: mode === 'return' ? 'bold' : 'normal' }}
        >
          Return
        </button>
      </div>

      {mode === 'return' && (
        <div style={{ marginBottom: '15px' }}>
          <label>Condition: </label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="EXCELLENT">Excellent</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
            <option value="DAMAGED">Damaged</option>
          </select>
        </div>
      )}

      <div id="reader" style={{ width: '100%' }}></div>

      <div style={{ margin: '10px 0' }}>
        {!scanning ? (
          <button onClick={startScan}>Start Camera</button>
        ) : (
          <button onClick={stopScan}>Stop Camera</button>
        )}
      </div>

      <form onSubmit={handleManual} style={{ marginTop: '20px' }}>
        <p>Ya ID haath se daalo:</p>
        <input
          placeholder="e.g. FB-001"
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
        />
        <button type="submit">{mode === 'issue' ? 'Issue' : 'Return'}</button>
      </form>

      {result && (
        <p
          style={{
            marginTop: '20px',
            padding: '10px',
            borderRadius: '6px',
            background: result.ok ? '#d4edda' : '#f8d7da',
            color: result.ok ? '#155724' : '#721c24'
          }}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}

export default Scan;