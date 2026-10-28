import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function QrPrint() {
  const [types,setTypes] = useState([]);
  const [units,setUnits] = useState([]);
  const [typeId,setTypeId] = useState('');
  const [error,setError] = useState('');
  useEffect(()=>{api.get('/equipment/types').then(r=>{const a=r.data.types||r.data.data||[];setTypes(a);if(a.length)setTypeId(a[0]._id);}).catch(e=>setError(e.response?.data?.message||'Could not load types.'));},[]);
  useEffect(()=>{if(typeId)api.get(`/equipment/types/${typeId}/units`).then(r=>setUnits(r.data.units||r.data.data||[])).catch(e=>setError(e.response?.data?.message||'Could not load units.'));},[typeId]);
  return <div>
    <div className="page-head"><p className="page-eyebrow">Administration</p><h1>QR Print</h1><p className="page-sub">Print equipment identifiers. Use the browser print dialog.</p></div>
    {error && <p className="notice notice-error">{error}</p>}
    <label>Equipment type<select value={typeId} onChange={e=>setTypeId(e.target.value)}>{types.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}</select></label>
    <button type="button" onClick={()=>window.print()} style={{margin:'16px 0'}}>Print labels</button>
    <div className="qr-print-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
      {units.map(u=><article key={u._id} className="card" style={{padding:16,textAlign:'center',breakInside:'avoid'}}>
        <h3>{types.find(t=>t._id===typeId)?.name}</h3><strong>{u.unitCode}</strong>
        <p>{u.status}</p><p style={{fontSize:12}}>Scan in Sports Room</p>
      </article>)}
    </div>
    <style>{`@media print { aside,.shell-top,.shell-side,.page-head button,button,label {display:none!important} .shell-content{padding:0!important}.qr-print-grid{grid-template-columns:repeat(3,1fr)!important}.card{border:1px solid #888;box-shadow:none} }`}</style>
  </div>;
}
