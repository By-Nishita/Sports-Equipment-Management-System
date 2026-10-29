import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../api/axios';

// The sticker QR holds JSON { "t": "TYPE-FOOTBALL" } - exactly what Scan.jsx reads.
const qrPayload = (type) => JSON.stringify({ t: type.qrIdentifier });

// Draws QR + equipment name on one canvas so the downloaded PNG is a ready sticker.
async function buildStickerBlob(type) {
  const qrUrl = await QRCode.toDataURL(qrPayload(type), { width: 600, margin: 2, errorCorrectionLevel: 'M' });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = qrUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 740;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 20, 20, 600, 600);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(type.name, 320, 675, 600);
  ctx.font = '24px sans-serif';
  ctx.fillText(type.qrIdentifier, 320, 715, 600);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function downloadSticker(type) {
  const blob = await buildStickerBlob(type);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type.qrIdentifier}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function QrPrint() {
  const [types, setTypes] = useState([]);
  const [qrs, setQrs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [params] = useSearchParams();
  const onlyTypeId = params.get('type');

  useEffect(() => {
    api.get('/equipment/types', { params: { limit: 200 } })
      .then(async r => {
        const all = r.data.types || r.data.data || [];
        // ?type=<id> shows just that one equipment's QR
        const list = onlyTypeId ? all.filter(t => t._id === onlyTypeId) : all;
        setTypes(list);
        const entries = await Promise.all(list.map(async t => [
          t._id,
          await QRCode.toDataURL(qrPayload(t), { width: 300, margin: 1, errorCorrectionLevel: 'M' })
        ]));
        setQrs(Object.fromEntries(entries));
      })
      .catch(e => setError(e.response?.data?.message || 'Could not load equipment types.'));
  }, [onlyTypeId]);

  async function onDownload(t) {
    setError('');
    setBusy(t._id);
    try { await downloadSticker(t); }
    catch { setError('Could not create the QR image. Please try again.'); }
    finally { setBusy(''); }
  }

  async function onDownloadAll() {
    setError('');
    setBusy('all');
    try {
      for (const t of types) {
        await downloadSticker(t);
        await new Promise(res => setTimeout(res, 300)); // browsers block downloads fired too fast
      }
    } catch { setError('Could not create the QR images. Please try again.'); }
    finally { setBusy(''); }
  }

  return <div>
    <div className="page-head">
      <p className="page-eyebrow">Sports Room</p>
      <h1>QR stickers</h1>
      <p className="page-sub">One QR per equipment type. Download a PNG or print all stickers on A4.</p>
    </div>
    {error && <p className="notice notice-error">{error}</p>}
    {onlyTypeId && <p className="qr-actions"><Link to="/admin/qr-print">Show QR of all equipment</Link></p>}
    <div className="qr-actions" style={{display:'flex',gap:8,margin:'0 0 16px',flexWrap:'wrap'}}>
      <button type="button" onClick={() => window.print()} disabled={!types.length}>Print all stickers</button>
      <button type="button" onClick={onDownloadAll} disabled={!types.length || busy === 'all'}>
        {busy === 'all' ? 'Preparing...' : 'Download all (PNG)'}
      </button>
    </div>
    <div className="qr-print-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
      {types.map(t => <article key={t._id} className="card qr-card" style={{padding:16,textAlign:'center',breakInside:'avoid'}}>
        {qrs[t._id]
          ? <img src={qrs[t._id]} alt={`QR code for ${t.name}`} style={{width:'100%',maxWidth:180,height:'auto'}} />
          : <p>Creating QR...</p>}
        <h3 style={{margin:'8px 0 0'}}>{t.name}</h3>
        <p style={{margin:'2px 0 8px',fontSize:12}}>{t.qrIdentifier}</p>
        <button type="button" className="qr-dl" onClick={() => onDownload(t)} disabled={busy === t._id || !qrs[t._id]}>
          {busy === t._id ? 'Preparing...' : 'Download PNG'}
        </button>
      </article>)}
      {!types.length && !error && <p>No equipment types yet.</p>}
    </div>
    <style>{`@media print {
      aside, .shell-top, .shell-side, .page-head, .qr-actions, .qr-dl, .notice { display:none !important }
      .shell-content { padding:0 !important }
      .qr-print-grid { grid-template-columns:repeat(3,1fr) !important }
      .qr-card { border:1px solid #888; box-shadow:none }
    }`}</style>
  </div>;
}
