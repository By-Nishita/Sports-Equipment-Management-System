// Last line of defence. Whatever goes wrong, the person sees a fixed message;
// the details (and the stack trace) go only to the server log.

const notFound = (req, res) =>
  res.status(404).json({ success: false, message: 'Not found', data: null });

// Express needs all four arguments to treat this as an error handler.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Problems with the request itself (not our bug)
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON', data: null });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request is too large', data: null });
  }

  console.error('UNHANDLED ERROR:', err);
  return res.status(500).json({ success: false, message: 'Server error', data: null });
};

module.exports = { notFound, errorHandler };
