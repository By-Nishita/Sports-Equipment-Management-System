// Small helpers so every response keeps the existing shape { success, message, data }.

const ok = (res, data, message = 'OK', status = 200, extra = {}) =>
  res.status(status).json({ success: true, message, data, ...extra });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fail = (res, status, message) => res.status(status).json({ success: false, message, data: null });

// Wrap async handlers; HttpError becomes a clean response, anything else a fixed message
// (stack traces only in logs).
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof HttpError) return fail(res, err.status, err.message);
    if (err && err.name === 'CastError') return fail(res, 400, 'Invalid id');
    if (err && err.code === 11000) return fail(res, 409, 'Duplicate value');
    console.error(err);
    return fail(res, 500, 'Server error');
  }
};

const parsePage = (query, defaults = { limit: 50, max: 200 }) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaults.limit, 1), defaults.max);
  return { page, limit, skip: (page - 1) * limit };
};

module.exports = { ok, fail, handle, HttpError, parsePage };
