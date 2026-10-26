// Small time helpers used by the session pages.

// "27 Oct, 4:05 pm"
export const formatTime = (value) =>
  value
    ? new Date(value).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '';

// "4:05 pm"
export const formatClock = (value) =>
  value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

// 75 -> "1 h 15 min"
export const formatMinutes = (minutes) => {
  if (minutes == null) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

// Whole minutes from a past moment until now (never negative)
export const minutesSince = (value) => Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));

// "just now", "3 min ago", "1 h 5 min ago"
export const formatAgo = (value) => {
  const m = minutesSince(value);
  return m < 1 ? 'just now' : `${formatMinutes(m)} ago`;
};
