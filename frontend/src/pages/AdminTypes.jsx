import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../api/axios';
import TypeThumb from '../components/TypeThumb';

const blank = { name:'', category:'', brand:'', description:'', trackingMode:'UNIT', stockQuantity:0, defaultIssueHours:2 };
const FIELDS = ['name','category','brand','description','trackingMode','stockQuantity','defaultIssueHours'];

export default function AdminTypes() {
  const [items,setItems] = useState([]);
  const [qrs,setQrs] = useState({});
  const [form,setForm] = useState(blank);
  const [editing,setEditing] = useState(null);
  const [photo,setPhoto] = useState(null);
  const [preview,setPreview] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const fileRef = useRef(null);

  async function load() {
    try {
      const r = await api.get('/equipment/types', { params: { limit: 200 } });
      const list = r.data.types || r.data.data || [];
      setItems(list);
      const entries = await Promise.all(list.map(async t => [
        t._id, await QRCode.toDataURL(JSON.stringify({ t: t.qrIdentifier }), { width: 120, margin: 1 })
      ]));
      setQrs(Object.fromEntries(entries));
    } catch(e) { setError(e.response?.data?.message || 'Could not load equipment types.'); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!photo) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function change(e) { setForm({...form,[e.target.name]:e.target.value}); }

  function pickPhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return setPhoto(null);
    if (!['image/jpeg','image/png','image/webp'].includes(f.type)) {
      setError('Photo must be a JPG, PNG or WebP file.'); e.target.value=''; return;
    }
    if (f.size > 5*1024*1024) { setError('Photo must be 5 MB or smaller.'); e.target.value=''; return; }
    setError(''); setPhoto(f);
  }

  function reset() {
    setForm(blank); setEditing(null); setPhoto(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submit(e) {
    e.preventDefault(); setError(''); setNotice('');
    try {
      // Send only the fields the backend accepts (not counts, _id, urls...)
      const body = {};
      FIELDS.forEach(f => { body[f] = form[f]; });
      body.stockQuantity = Number(body.stockQuantity);
      body.defaultIssueHours = Number(body.defaultIssueHours);

      let id = editing;
      if (editing) await api.patch(`/equipment/types/${editing}`, body);
      else {
        const r = await api.post('/equipment/types', body);
        id = r.data.data?._id || r.data._id;
      }

      let photoFailed = '';
      if (photo && id) {
        try {
          const fd = new FormData();
          fd.append('photo', photo);
          await api.post(`/equipment/types/${id}/photo`, fd); // axios sets the multipart header itself
        } catch(pe) {
          photoFailed = pe.response?.data?.message || 'Photo upload failed.';
        }
      }
      if (photoFailed) {
        setError(`Saved, but the photo was not uploaded: ${photoFailed}`);
      } else {
        setNotice(editing ? 'Equipment type updated.' : 'Equipment type created.');
      }
      reset(); await load();
    } catch(e) { setError(e.response?.data?.message || 'Save failed. Check required fields and backend validation.'); }
  }

  function edit(x) {
    setEditing(x._id);
    setForm({...blank, ...Object.fromEntries(FIELDS.map(f => [f, x[f] ?? blank[f]]))});
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = '';
    window.scrollTo({top:0,behavior:'smooth'});
  }

  const editingItem = items.find(i => i._id === editing);
  const shownPhoto = preview || editingItem?.imageUrl || '';

  return <div>
    <div className="page-head"><p className="page-eyebrow">Administration</p><h1>Equipment Types</h1><p className="page-sub">Create and update equipment, add photos, and see each QR sticker.</p></div>
    {error && <p className="notice notice-error">{error}</p>}
    {notice && <p className="notice notice-ok">{notice}</p>}
    <form className="card" onSubmit={submit} style={{padding:20,display:'grid',gap:12,maxWidth:700}}>
      <h2>{editing ? 'Edit equipment type' : 'Create equipment type'}</h2>
      <label>Name *<input required name="name" value={form.name} onChange={change} /></label>
      <label>Category<input name="category" value={form.category || ''} onChange={change} /></label>
      <label>Brand<input name="brand" value={form.brand || ''} onChange={change} /></label>
      <label>Description<textarea name="description" value={form.description || ''} onChange={change} /></label>
      <label>Tracking mode<select name="trackingMode" value={form.trackingMode} onChange={change}><option value="UNIT">Individual units</option><option value="QUANTITY">Quantity-based</option></select></label>
      <label>Stock quantity (quantity-based only)<input type="number" min="0" name="stockQuantity" value={form.stockQuantity} onChange={change} /></label>
      <label>Default issue time (hours)<input type="number" min="0.5" step="0.5" name="defaultIssueHours" value={form.defaultIssueHours} onChange={change} /></label>
      <label>Photo (JPG, PNG or WebP, max 5 MB)
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} />
      </label>
      {shownPhoto && <img src={shownPhoto} alt="Photo preview" style={{width:160,height:120,objectFit:'contain',border:'1px solid #ddd',borderRadius:8}} />}
      <div style={{display:'flex',gap:8}}><button type="submit">{editing ? 'Save changes' : 'Create type'}</button>{editing && <button type="button" onClick={reset}>Cancel</button>}</div>
    </form>
    <h2>Existing types ({items.length})</h2>
    <p><Link to="/admin/qr-print">Download or print QR stickers</Link></p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Photo</th><th>Name</th><th>Category</th><th>Tracking</th><th>Available</th><th>QR</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {items.map(x=><tr key={x._id}>
        <td><TypeThumb type={x} size={48} /></td>
        <td>{x.name}</td><td>{x.category || '—'}</td><td>{x.trackingMode}</td>
        <td>{x.counts ? `${x.counts.available} / ${x.counts.total}` : '—'}</td>
        <td>{qrs[x._id] ? <img src={qrs[x._id]} alt={`QR ${x.qrIdentifier}`} width={60} height={60} /> : '—'}<div style={{fontSize:11}}>{x.qrIdentifier}</div></td>
        <td>{x.isActive === false ? 'Inactive' : 'Active'}</td>
        <td><button type="button" onClick={()=>edit(x)}>Edit</button></td>
      </tr>)}
    </tbody></table></div>
  </div>;
}
