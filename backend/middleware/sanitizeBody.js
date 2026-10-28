// Stops NoSQL injection through the request body: a key like "$ne" or "$gt" is removed, so
// { "email": { "$ne": null } } becomes { "email": {} } and can never reach a database filter.
//
// Why not the express-mongo-sanitize package: it assigns to req.query, which Express 5 does not
// allow (it throws). Express 5 also parses query strings as plain text only ("?a[$ne]=1" does not
// become an object), so only the body needs cleaning.

const MAX_DEPTH = 20;

function clean(value, depth) {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => clean(item, depth + 1));
  const out = {};
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    out[key] = clean(value[key], depth + 1);
  }
  return out;
}

const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body, 0);
  next();
};

module.exports = sanitizeBody;
module.exports.clean = clean;
