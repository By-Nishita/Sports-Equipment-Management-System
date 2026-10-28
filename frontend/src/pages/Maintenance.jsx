import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function Maintenance() {
  const [units,setUnits] = useState([]);
  const [records,setRecords] = useState([]);
  const [unit,setUnit] = useState('');
  const [description,setDescription] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  async function loadUnits() {
    try {
      const t=await api.get('/equipment/types');
      const types=t.data.types||t.data.data||[];
      const all=await Promise.all(types.map(x=>api.get(`/equipment/types/${x._id}/units`).then(r=>r.data.units||r.data.data||[]).catch(()=>[])));
      const list=all.flat();setUnits(list);if(list.length)setUnit(old=>old||list[0]._id);
    } catch(e) {setError(e.response?.data?.message||'Could not load equipment units.');}
  }
  async function loadRecords() {
    try {const r=await api.get('/maintenance');setRecords(r.data.records||r.data.data||[]);}
    catch(e) {setError(e.response?.data?.message||'Maintenance API is not available yet.');}
  }
  useEffect(()=>{loadUnits();loadRecords();},[]);
  async function submit(e) {
    e.preventDefault();setError('');setNotice('');
    try {
      await api.post('/maintenance',{unit,description});
      setDescription('');setNotice('Maintenance record created.');await loadRecords();
    } catch(e) {setError(e.response?.data?.message||'Maintenance endpoint is not implemented or the request failed.');}
  }
  return <div>
    <div className="page-head"><p className="page-eyebrow">Administration</p><h1>Maintenance</h1><p className="page-sub">Record maintenance work for equipment units.</p></div>
    {error && <p className="notice notice-error">{error}</p>}{notice && <p className="notice notice-ok">{notice}</p>}
    <form className="card" onSubmit={submit} style={{padding:20,display:'grid',gap:12,maxWidth:650}}>
      <label>Equipment unit<select required value={unit} onChange={e=>setUnit(e.target.value)}>{units.map(u=><option key={u._id} value={u._id}>{u.unitCode} — {u.status}</option>)}</select></label>
      <label>Maintenance details<textarea required value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the issue or maintenance work..." /></label>
      <button disabled={!unit || !description.trim()}>Create maintenance record</button>
    </form>
    <h2>Maintenance records</h2>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Unit</th><th>Details</th><th>Status</th><th>Date</th></tr></thead><tbody>
      {records.map((r,i)=><tr key={r._id||i}><td>{r.unit?.unitCode||r.unitCode||r.unit||'—'}</td><td>{r.description||r.notes||'—'}</td><td>{r.status||'—'}</td><td>{r.createdAt?new Date(r.createdAt).toLocaleDateString('en-IN'):'—'}</td></tr>)}
    </tbody></table></div>
  </div>;
}
