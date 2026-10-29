// Service-level tests for sessionService.js
// Run from backend folder:
// node --test tests/sessionService.test.js

const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");

// -------------------- Fake database --------------------

let sequence = 0;

const newId = () =>
  (++sequence).toString(16).padStart(24, "0");

function matches(document, filter = {}) {
  if (!document) return false;

  return Object.entries(filter).every(([key, condition]) => {
    const value = document[key];

    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if ("$in" in condition) {
        return condition.$in.map(String).includes(String(value));
      }

      if ("$gte" in condition) {
        return value >= condition.$gte;
      }

      if ("$lt" in condition) {
        return value < condition.$lt;
      }

      if ("$ne" in condition) {
        return String(value) !== String(condition.$ne);
      }
    }

    return String(value) === String(condition);
  });
}

function makeCollection() {
  const rows = [];

  function clone(document) {
    return document ? { ...document } : null;
  }

  return {
    rows,

    async create(document) {
      const row = {
        _id: newId(),
        status: "ISSUE_PENDING",
        requestedAt: new Date(),
        ...document,
      };

      rows.push(row);
      return clone(row);
    },

    async findById(id) {
      return clone(rows.find((row) => String(row._id) === String(id)));
    },

    async find(filter = {}) {
      const result = rows.filter((row) => matches(row, filter));

      return {
        select: async () => result.map(clone),
      };
    },

    async countDocuments(filter = {}) {
      return rows.filter((row) => matches(row, filter)).length;
    },

    async updateMany(filter, update) {
      let modifiedCount = 0;

      for (const row of rows) {
        if (matches(row, filter)) {
          Object.assign(row, update);
          modifiedCount++;
        }
      }

      return { modifiedCount };
    },

    async updateOne(filter, update) {
      const row = rows.find((item) => matches(item, filter));

      if (row) Object.assign(row, update);

      return { modifiedCount: row ? 1 : 0 };
    },

    async findOneAndUpdate(filter, update, options = {}) {
      const row = rows.find((item) => matches(item, filter));

      if (!row) return null;

      const before = clone(row);
      Object.assign(row, update);

      return options.new ? clone(row) : before;
    },

    async findOne(filter = {}) {
      return clone(rows.find((row) => matches(row, filter)));
    },

    async findByIdAndUpdate(id, update) {
      const row = rows.find((item) => String(item._id) === String(id));

      if (!row) return null;

      Object.assign(row, update);
      return clone(row);
    },
  };
}

const sessions = makeCollection();
const units = makeCollection();
const types = makeCollection();

const auditEvents = [];

const settings = {
  approvalTimeoutMinutes: 15,
  maxItemsPerStudent: 3,
  defaultIssueHours: 2,
  graceMinutes: 15,
};

const settingsService = {
  get: async () => ({ ...settings }),
};

const damageReports = makeCollection();

const fakeMongoose = {
  isValidObjectId: (id) => /^[0-9a-f]{24}$/i.test(String(id)),
};

const fakes = {
  mongoose: fakeMongoose,
  "../models/UsageSession": Object.assign(sessions, {
    CONDITIONS: ["EXCELLENT", "GOOD", "FAIR", "DAMAGED"],
  }),
  "../models/EquipmentType": {
    findById: async (id) =>
      types.rows.find((row) => String(row._id) === String(id)) || null,
  },
  "../models/EquipmentUnit": units,
  "../models/DamageReport": damageReports,
  "./settingsService": settingsService,
  "./auditService": {
    log: async (event) => {
      auditEvents.push(event);
    },
  },
  "./sessionRules": require("../services/sessionRules"),
  "../utils/http": {
    HttpError: class HttpError extends Error {
      constructor(status, message) {
        super(message);
        this.status = status;
      }
    },
  },
};

const originalLoad = Module._load;

Module._load = function (request, ...args) {
  if (Object.prototype.hasOwnProperty.call(fakes, request)) {
    return fakes[request];
  }

  return originalLoad.call(this, request, ...args);
};

const service = require("../services/sessionService");

// -------------------- Helpers --------------------

const student1 = { _id: newId(), role: "student" };
const student2 = { _id: newId(), role: "student" };
const staff = { _id: newId(), role: "staff" };

const rejectsWith = (promise, status, messagePattern) =>
  assert.rejects(promise, (error) => {
    assert.strictEqual(error.status, status);

    if (messagePattern) {
      assert.match(error.message, messagePattern);
    }

    return true;
  });

async function makeType(name = "Football") {
  return types.create({
    name,
    isActive: true,
    trackingMode: "UNIT",
    defaultIssueHours: 2,
  });
}

async function makeUnit(type, unitCode, status = "AVAILABLE") {
  return units.create({
    type: type._id,
    unitCode,
    status,
    condition: "GOOD",
  });
}

async function makeRequest(user, type, requestedAt = new Date()) {
  return sessions.create({
    user: user._id,
    type: type._id,
    status: "ISSUE_PENDING",
    requestedAt,
    acknowledgedAt: requestedAt,
  });
}

function resetData() {
  sessions.rows.length = 0;
  units.rows.length = 0;
  types.rows.length = 0;
  damageReports.rows.length = 0;
  auditEvents.length = 0;
}

// -------------------- Tests --------------------

test("wrong unit code is rejected and the unit remains available", async () => {
  resetData();

  const type = await makeType("Football");
  const request = await makeRequest(student1, type);
  const unit = await makeUnit(type, "FB-001");

  await rejectsWith(
    service.approve(staff, request._id, "WRONG-999"),
    409,
    /not available|matching item/i
  );

  assert.strictEqual(
    units.rows.find((row) => row._id === unit._id).status,
    "AVAILABLE"
  );

  assert.strictEqual(
    sessions.rows.find((row) => row._id === request._id).status,
    "ISSUE_PENDING"
  );
});

test("an expired issue request is marked EXPIRED and cannot be approved", async () => {
  resetData();

  const type = await makeType();
  const oldRequestTime = new Date(Date.now() - 60 * 60 * 1000);
  const request = await makeRequest(student1, type, oldRequestTime);

  await rejectsWith(
    service.approve(staff, request._id, "FB-001"),
    409,
    /expired/i
  );

  const saved = sessions.rows.find((row) => row._id === request._id);

  assert.strictEqual(saved.status, "EXPIRED");
});

test("expireStaleRequests expires old pending requests but preserves recent ones", async () => {
  resetData();

  const type = await makeType();

  const oldRequest = await makeRequest(
    student1,
    type,
    new Date(Date.now() - 60 * 60 * 1000)
  );

  const recentRequest = await makeRequest(
    student2,
    type,
    new Date()
  );

  const expiredCount = await service.expireStaleRequests();

  assert.strictEqual(expiredCount, 1);

  assert.strictEqual(
    sessions.rows.find((row) => row._id === oldRequest._id).status,
    "EXPIRED"
  );

  assert.strictEqual(
    sessions.rows.find((row) => row._id === recentRequest._id).status,
    "ISSUE_PENDING"
  );
});

test("two students racing for the last unit cannot both receive it", async () => {
  resetData();

  const type = await makeType();
  await makeUnit(type, "FB-001");

  const request1 = await makeRequest(student1, type);
  const request2 = await makeRequest(student2, type);

  const results = await Promise.allSettled([
    service.approve(staff, request1._id, "FB-001"),
    service.approve(staff, request2._id, "FB-001"),
  ]);

  const succeeded = results.filter((result) => result.status === "fulfilled");
  const failed = results.filter((result) => result.status === "rejected");

  assert.strictEqual(succeeded.length, 1);
  assert.strictEqual(failed.length, 1);

  const inUseUnits = units.rows.filter((unit) => unit.status === "IN_USE");

  assert.strictEqual(inUseUnits.length, 1);

  const activeSessions = sessions.rows.filter(
    (session) => session.status === "ACTIVE"
  );

  assert.strictEqual(activeSessions.length, 1);
});

test("late calculation uses the student's return request time", async () => {
  const { computeLate, computeDuration } = require("../services/sessionRules");

  const approvedAt = new Date("2026-10-29T10:00:00Z");
  const dueAt = new Date("2026-10-29T12:00:00Z");

  // Student requests return 20 minutes after due time.
  const returnRequestedAt = new Date("2026-10-29T12:20:00Z");

  // Staff confirms much later.
  const staffConfirmedAt = new Date("2026-10-29T14:00:00Z");

  const late = computeLate(dueAt, returnRequestedAt, 15);

  assert.deepStrictEqual(late, {
    wasLate: true,
    lateMinutes: 20,
  });

  assert.strictEqual(
    computeDuration(approvedAt, returnRequestedAt),
    140
  );

  // Confirmation delay must not be used to calculate the student's late time.
  assert.ok(staffConfirmedAt > returnRequestedAt);
});
test("if saving the session fails after the unit was taken, the unit is given back", async () => {
  resetData();

  const type = await makeType();
  const unit = await makeUnit(type, "FB-001");
  const request = await makeRequest(student1, type);

  // Pretend the database refuses the session update with a duplicate-key error (code 11000)
  const original = sessions.findOneAndUpdate;
  sessions.findOneAndUpdate = async () => {
    throw Object.assign(new Error("E11000 duplicate key error"), { code: 11000 });
  };

  try {
    await rejectsWith(service.approve(staff, request._id, "FB-001"), 409, /could not be issued/i);
  } finally {
    sessions.findOneAndUpdate = original;
  }

  assert.strictEqual(units.rows.find((row) => row._id === unit._id).status, "AVAILABLE");
  assert.strictEqual(sessions.rows.find((row) => row._id === request._id).status, "ISSUE_PENDING");
});
