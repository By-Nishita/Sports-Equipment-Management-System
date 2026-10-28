import './DamageReportRow.css';

const STATUS_LABEL = {
  PENDING: 'Waiting for staff',
  UNDER_REVIEW: 'Staff is checking',
  RESOLVED: 'Resolved'
};

const RESOLUTION_LABEL = {
  REPAIRED: 'Repaired and back in use',
  RETIRED: 'Removed from use',
  LOST: 'Marked as lost'
};

// One report in one card (the student's own list uses this).
function DamageReportRow({ report }) {
  const { unit, type, description, status, resolution, staffNote, createdAt } = report;

  return (
    <li className="card dr-row">
      <div className="dr-head">
        <strong>
          {unit?.type?.name || 'Unknown item'}
          {unit?.unitCode && <span className="dr-id"> {unit.unitCode}</span>}
        </strong>
        <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABEL[status] || status}</span>
      </div>

      <p className="dr-type">{type === 'LOSS' ? 'Lost' : 'Damaged'}</p>
      <p>{description}</p>

      {status === 'RESOLVED' && resolution && (
        <p className="dr-outcome">{RESOLUTION_LABEL[resolution] || resolution}</p>
      )}
      {staffNote && <p className="dr-note">Staff note: {staffNote}</p>}

      <p className="dr-date">Reported {new Date(createdAt).toLocaleString()}</p>
    </li>
  );
}

export default DamageReportRow;
