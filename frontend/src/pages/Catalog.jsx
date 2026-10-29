import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import TypeThumb from '../components/TypeThumb';

function currentRole() {
  try { return JSON.parse(localStorage.getItem('user'))?.role || 'student'; } catch { return 'student'; }
}

export default function Catalog() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const role = currentRole();
  const canSeeQr = role === 'staff' || role === 'admin';

  useEffect(() => {
    api.get('/equipment/types', { params: { limit: 200 } })
      .then(r => setItems(r.data.types || r.data.data || []))
      .catch(e => setError(e.response?.data?.message || 'Could not load equipment catalog.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(x =>
    `${x.name} ${x.category || ''} ${x.brand || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return <div>
    <div className="page-head">
      <p className="page-eyebrow">Sports Room</p>
      <h1>Equipment Catalog</h1>
      <p className="page-sub">See what is in the Sports Room and how many are free right now.</p>
    </div>
    <input aria-label="Search equipment" placeholder="Search by name, category or brand..."
      value={search} onChange={e => setSearch(e.target.value)}
      style={{padding:12,width:'100%',maxWidth:500,marginBottom:20}} />
    {error && <p className="notice notice-error">{error}</p>}
    {loading ? <p>Loading catalog...</p> : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:16}}>
      {filtered.map(x => {
        // Backend sends counts: { total, available, inUse, damaged } with every type.
        const c = x.counts || { total: 0, available: 0, inUse: 0, damaged: 0 };
        const free = c.available > 0;
        return <article className="card" key={x._id} style={{padding:16,display:'grid',gap:8,alignContent:'start'}}>
          {x.imageUrl
            ? <img src={x.imageUrl} alt={x.name} loading="lazy" style={{width:'100%',height:150,objectFit:'contain'}} />
            : <div style={{display:'grid',placeItems:'center',height:150}}><TypeThumb type={x} size={96} /></div>}
          <h3 style={{margin:0}}>{x.name}</h3>
          <p style={{margin:0}}>{[x.category || 'Uncategorized', x.brand].filter(Boolean).join(' · ')}</p>
          {x.description && <p style={{margin:0}}>{x.description}</p>}
          <p style={{margin:0}}>
            <span className={`badge ${free ? 'badge-available' : 'badge-damaged'}`}>
              {free ? `${c.available} of ${c.total} available` : 'None available'}
            </span>
          </p>
          {x.trackingMode !== 'QUANTITY' && <p style={{margin:0,fontSize:13}}>
            In use: {c.inUse} · Damaged: {c.damaged}
          </p>}
          {canSeeQr && <Link to={`/admin/qr-print?type=${x._id}`} style={{fontSize:13}}>View QR sticker ({x.qrIdentifier})</Link>}
        </article>;
      })}
      {!filtered.length && <p>No equipment found.</p>}
    </div>}
  </div>;
}
