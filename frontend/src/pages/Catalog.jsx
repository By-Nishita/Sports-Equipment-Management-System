import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function Catalog() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/equipment/types')
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
      <p className="page-sub">Browse available equipment and its details.</p>
    </div>
    <input aria-label="Search equipment" placeholder="Search by name, category or brand..."
      value={search} onChange={e => setSearch(e.target.value)}
      style={{padding:12,width:'100%',maxWidth:500,marginBottom:20}} />
    {error && <p className="notice notice-error">{error}</p>}
    {loading ? <p>Loading catalog...</p> : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:16}}>
      {filtered.map(x => <article className="card" key={x._id} style={{padding:16}}>
        {x.imageUrl && <img src={x.imageUrl} alt={x.name} style={{width:'100%',height:150,objectFit:'contain'}} />}
        <h3>{x.name}</h3>
        <p>{x.category || 'Uncategorized'} {x.brand ? `· ${x.brand}` : ''}</p>
        <p>{x.description || 'No description available.'}</p>
        <p><strong>Tracking:</strong> {x.trackingMode || 'UNIT'}</p>
        <p><strong>Units:</strong> {x.unitCount ?? x.totalUnits ?? x.stockQuantity ?? '—'}</p>
        <p><strong>Status:</strong> {x.isActive === false ? 'Inactive' : 'Active'}</p>
      </article>)}
      {!filtered.length && <p>No equipment found.</p>}
    </div>}
  </div>;
}
