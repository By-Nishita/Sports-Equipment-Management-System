import { useEffect, useState } from 'react';
import api from '../api/axios';

const blank = { name:'', category:'', brand:'', description:'', trackingMode:'UNIT', stockQuantity:0, defaultIssueHours:2 };

export default function AdminTypes() {
  const [items,setItems] = useState([]);
  const [form,setForm] = useState(blank);
  const [editing,setEditing] = useState(null);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  async function load() {
    try {
      const r = await api.get('/equipment/types');
      setItems(r.data.types || r.data.data || []);
    } catch(e) { setError(e.response?.data?.message || 'Could not load equipment types.'); }
  }
  useEffect(() => { load(); }, []);

  function change(e) { setForm({...form,[e.target.name]:e.target.value}); }

  async function submit(e) {
    e.preventDefault(); setError(''); setNotice('');
    try {
      const body = {...form, stockQuantity:Number(form.stockQuantity), defaultIssueHours:Number(form.defaultIssueHours)};
      if(editing) await api.patch(`/equipment/types/${editing}`,body);
      else await api.post('/equipment/types',body);
      setNotice(editing ? 'Equipment type updated.' : 'Equipment type created.');
      setForm(blank); setEditing(null); await load();
    } catch(e) { setError(e.response?.data?.message || 'Save failed. Check required fields and backend validation.'); }
  }

  function edit(x) {
    setEditing(x._id);
    setForm({...blank,...x});
    window.scrollTo({top:0,behavior:'smooth'});
  }

  return <div>
    <div className="page-head"><p className="page-eyebrow">Administration</p><h1>Equipment Types</h1><p className="page-sub">Create and update equipment categories and product details.</p></div>
    {error && <p className="notice notice-error">{error}</p>}
    {notice && <p className="notice notice-ok">{notice}</p>}
    <form className="card" onSubmit={submit} style={{padding:20,display:'grid',gap:12,maxWidth:700}}>
      <h2>{editing ? 'Edit equipment type' : 'Create equipment type'}</h2>
      <label>Name *<input required name="name" value={form.name} onChange={change} /></label>
      <label>Category<input name="category" value={form.category || ''} onChange={change} /></label>
      <label>Brand<input name="brand" value={form.brand || ''} onChange={change} /></label>
      <label>Description<textarea name="description" value={form.description || ''} onChange={change} /></label>
      <label>Tracking mode<select name="trackingMode" value={form.trackingMode} onChange={change}><option value="UNIT">Individual units</option><option value="QUANTITY">Quantity-based</option></select></label>
      <label>Stock quantity<input type="number" min="0" name="stockQuantity" value={form.stockQuantity} onChange={change} /></label>
      <label>Default issue time (hours)<input type="number" min="0.5" step="0.5" name="defaultIssueHours" value={form.defaultIssueHours} onChange={change} /></label>
      <div style={{display:'flex',gap:8}}><button type="submit">{editing ? 'Save changes' : 'Create type'}</button>{editing && <button type="button" onClick={()=>{setEditing(null);setForm(blank);}}>Cancel</button>}</div>
    </form>
    <h2>Existing types ({items.length})</h2>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Name</th><th>Category</th><th>Tracking</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {items.map(x=><tr key={x._id}><td>{x.name}</td><td>{x.category || '—'}</td><td>{x.trackingMode}</td><td>{x.isActive === false ? 'Inactive' : 'Active'}</td><td><button type="button" onClick={()=>edit(x)}>Edit</button></td></tr>)}
    </tbody></table></div>
  </div>;
}
