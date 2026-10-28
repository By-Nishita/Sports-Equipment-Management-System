import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function AdminUnits() {
  const [types,setTypes] = useState([]);
  const [units,setUnits] = useState([]);
  const [typeId,setTypeId] = useState('');
  const [prefix,setPrefix] = useState('BALL');
  const [from,setFrom] = useState(1);
  const [to,setTo] = useState(10);
  const [unitCode,setUnitCode] = useState('');
  const [location,setLocation] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  async function loadTypes() {
    try {
      const r = await api.get('/equipment/types');
      const list = r.data.types || r.data.data || [];
      setTypes(list);
      if(list.length) setTypeId(old => old || list[0]._id);
    } catch(e) { setError(e.response?.data?.message || 'Could not load types.'); }
  }
  async function loadUnits(id=typeId) {
    if(!id) return;
    try {
      const r = await api.get(`/equipment/types/${id}/units`);
      setUnits(r.data.units || r.data.data || []);
    } catch(e) { setError(e.response?.data?.message || 'Could not load units.'); }
  }
  useEffect(()=>{loadTypes();},[]);
  useEffect(()=>{if(typeId) loadUnits(typeId);},[typeId]);

  async function createOne(e) {
    e.preventDefault();setError('');setNotice('');
    try {
      await api.post('/equipment/units',{typeId,unitCode,location});
      setUnitCode('');setNotice('Unit created.');await loadUnits();
    } catch(e) {setError(e.response?.data?.message || 'Could not create unit.');}
  }
  async function createBulk(e) {
    e.preventDefault();setError('');setNotice('');
    try {
      const r=await api.post('/equipment/units/bulk',{typeId,prefix,from:Number(from),to:Number(to),location});
      setNotice(r.data.message || 'Bulk unit creation completed.');await loadUnits();
    } catch(e) {setError(e.response?.data?.message || 'Bulk creation failed.');}
  }
  async function updateUnit(id,e) {
    const status=e.target.value;
    try {
      await api.patch(`/equipment/units/${id}`,{status});
      setNotice('Unit updated.');await loadUnits();
    } catch(err) {setError(err.response?.data?.message || 'Could not update unit.');}
  }

  return <div>
    <div className="page-head"><p className="page-eyebrow">Administration</p><h1>Equipment Units</h1><p className="page-sub">Create individual units or generate a numbered batch.</p></div>
    {error && <p className="notice notice-error">{error}</p>}{notice && <p className="notice notice-ok">{notice}</p>}
    <div className="card" style={{padding:16,marginBottom:16}}>
      <label>Equipment type<select value={typeId} onChange={e=>setTypeId(e.target.value)}>{types.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}</select></label>
    </div>
    <form className="card" onSubmit={createOne} style={{padding:16,display:'grid',gap:10,maxWidth:600}}>
      <h2>Create one unit</h2>
      <label>Unit code *<input required value={unitCode} onChange={e=>setUnitCode(e.target.value)} placeholder="e.g. BALL-001" /></label>
      <label>Location<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Sports room" /></label>
      <button disabled={!typeId}>Create unit</button>
    </form>
    <form className="card" onSubmit={createBulk} style={{padding:16,display:'grid',gap:10,maxWidth:600,marginTop:16}}>
      <h2>Bulk-create units</h2>
      <label>Code prefix<input required value={prefix} onChange={e=>setPrefix(e.target.value)} /></label>
      <div style={{display:'flex',gap:12}}><label>From<input type="number" min="1" required value={from} onChange={e=>setFrom(e.target.value)} /></label><label>To<input type="number" min={from} required value={to} onChange={e=>setTo(e.target.value)} /></label></div>
      <label>Location<input value={location} onChange={e=>setLocation(e.target.value)} /></label>
      <button disabled={!typeId || Number(to)<Number(from)}>Generate units</button>
    </form>
    <h2>Units ({units.length})</h2>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Code</th><th>Status</th><th>Condition</th><th>Location</th><th>Update status</th></tr></thead><tbody>
      {units.map(u=><tr key={u._id}><td>{u.unitCode}</td><td>{u.status}</td><td>{u.condition}</td><td>{u.location || '—'}</td><td><select value={u.status} onChange={e=>updateUnit(u._id,e)}>{['AVAILABLE','IN_USE','RETURN_PENDING','DAMAGED','MAINTENANCE','LOST','RETIRED'].map(s=><option key={s}>{s}</option>)}</select></td></tr>)}
    </tbody></table></div>
  </div>;
}
