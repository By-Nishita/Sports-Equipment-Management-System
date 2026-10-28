// Run from the backend folder:  node --test tests/securityMiddleware.test.js
const test = require("node:test");
const assert = require("node:assert");
const sanitizeBody = require("../middleware/sanitizeBody");
const { notFound, errorHandler } = require("../middleware/errorHandlers");

const fakeRes = () => {
  const r = { headersSent: false, statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

test("keys that start with $ or contain a dot are removed, at any depth", () => {
  const req = { body: { email: { $ne: null }, name: "A", nested: { ok: 1, "$where": "x", "a.b": 2, list: [{ $gt: 1, v: 2 }] } } };
  let called = false;
  sanitizeBody(req, {}, () => { called = true; });
  assert.ok(called);
  assert.deepStrictEqual(req.body, { email: {}, name: "A", nested: { ok: 1, list: [{ v: 2 }] } });
});

test("normal bodies, empty bodies and non-objects pass through", () => {
  const a = { body: { phone: "123", n: 5, flag: true, none: null } };
  sanitizeBody(a, {}, () => {});
  assert.deepStrictEqual(a.body, { phone: "123", n: 5, flag: true, none: null });
  const b = { body: undefined };
  sanitizeBody(b, {}, () => {});
  assert.strictEqual(b.body, undefined);
});

test("notFound answers 404 in the usual shape", () => {
  const res = fakeRes();
  notFound({}, res);
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.success, false);
});

test("an unexpected error shows only 'Server error' and is logged", () => {
  const res = fakeRes();
  const logged = [];
  const orig = console.error; console.error = (...a) => logged.push(a);
  errorHandler(new Error("secret database detail at C:\\app\\x.js"), {}, res, () => {});
  console.error = orig;
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.message, "Server error");
  assert.ok(!JSON.stringify(res.body).includes("secret"));
  assert.strictEqual(logged.length, 1);
});

test("broken JSON is a 400 and a huge body is a 413", () => {
  let res = fakeRes();
  errorHandler({ type: "entity.parse.failed" }, {}, res, () => {});
  assert.strictEqual(res.statusCode, 400);
  res = fakeRes();
  errorHandler({ type: "entity.too.large" }, {}, res, () => {});
  assert.strictEqual(res.statusCode, 413);
});

test("if the answer was already started, the error is passed on", () => {
  const res = fakeRes(); res.headersSent = true;
  let passed = null;
  errorHandler(new Error("x"), {}, res, (e) => { passed = e; });
  assert.ok(passed instanceof Error);
});
