// All report queries. Every function returns { rows, total, summary } so the controller
// (and the CSV download) can treat every report the same way.
const mongoose = require('mongoose');
const UsageSession = require('../models/UsageSession');
const DamageReport = require('../models/DamageReport');
const EquipmentUnit = require('../models/EquipmentUnit');
const EquipmentType = require('../models/EquipmentType');
const User = require('../models/User');
const settingsService = require('./settingsService');
const rules = require('./reportRules');
const { HttpError } = require('../utils/http');

const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
// One session can add at most this many minutes (a forgotten return must not ruin the numbers).
const MAX_SESSION_MINUTES = 12 * 60;
const APPROVED = ['ACTIVE', 'RETURN_PENDING', 'RETURNED']; // sessions where a unit was really handed over
const minutesOf = { $min: [{ $ifNull: ['$durationMinutes', 0] }, MAX_SESSION_MINUTES] };

const oid = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, `Invalid ${label}`);
  return new mongoose.Types.ObjectId(id);
};

// ---------- shared pieces ----------

/** Which equipment types are allowed: null = all, otherwise an array of ids. */
async function allowedTypeIds({ type, category }) {
  if (type) return [oid(type, 'type')];
  if (category) return EquipmentType.find({ category: String(category) }).distinct('_id');
  return null;
}

async function allowedUserIds({ department }) {
  if (!department) return null;
  return User.find({ department: String(department) }).distinct('_id');
}

/** $match for sessions in the date range (on dateField) plus the optional filters. */
async function sessionMatch(f, dateField = 'approvedAt') {
  const match = { [dateField]: { $gte: f.from, $lt: f.to } };
  const types = await allowedTypeIds(f);
  if (types) match.type = { $in: types };
  const users = await allowedUserIds(f);
  if (users) match.user = { $in: users };
  return match;
}

/** $facet stage: one page of rows plus the total number of rows. */
async function runPaged(Model, pipeline, sort, { skip, limit }) {
  const [res] = await Model.aggregate([
    ...pipeline,
    { $facet: { rows: [{ $sort: { ...sort, _id: 1 } }, { $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ]);
  return { rows: res.rows, total: res.total[0] ? res.total[0].n : 0 };
}

const lookupType = [
  { $lookup: { from: 'equipmenttypes', localField: '_id', foreignField: '_id', as: 't' } },
  { $unwind: '$t' },
];
const lookupUser = [
  { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
  { $unwind: '$u' },
];

// ---------- 1. usage by type ----------
async function usageByType(f, page) {
  const match = { ...(await sessionMatch(f)), status: 'RETURNED' };
  const out = await runPaged(UsageSession, [
    { $match: match },
    { $group: { _id: '$type', sessions: { $sum: 1 }, minutes: { $sum: minutesOf } } },
    ...lookupType,
    { $project: { _id: 1, name: '$t.name', category: '$t.category', sessions: 1, minutes: 1 } },
  ], { sessions: -1 }, page);
  const rows = out.rows.map((r) => ({
    name: r.name, category: r.category || '', sessions: r.sessions, hours: rules.round1(r.minutes / 60),
  }));
  return { rows, total: out.total, summary: null };
}

// ---------- 2. utilization ----------
async function utilization(f) {
  const settings = await settingsService.get();
  const openHours = Math.max(1, settings.closingHour - settings.openingHour);
  const types = await allowedTypeIds(f);

  const unitMatch = { status: { $nin: ['RETIRED', 'LOST'] } };
  if (types) unitMatch.type = { $in: types };

  const [unitRows, usageRows] = await Promise.all([
    EquipmentUnit.aggregate([{ $match: unitMatch }, { $group: { _id: '$type', units: { $sum: 1 } } }]),
    UsageSession.aggregate([
      { $match: { ...(await sessionMatch(f)), status: 'RETURNED' } },
      { $group: { _id: '$type', minutes: { $sum: minutesOf } } },
    ]),
  ]);
  const minutesByType = new Map(usageRows.map((r) => [String(r._id), r.minutes]));
  const typeDocs = await EquipmentType.find({ _id: { $in: unitRows.map((r) => r._id) } }).select('name category').lean();
  const nameById = new Map(typeDocs.map((t) => [String(t._id), t]));

  let totalUnits = 0;
  let totalMinutes = 0;
  const rows = unitRows.map((r) => {
    const minutes = minutesByType.get(String(r._id)) || 0;
    const u = rules.utilizationPercent(minutes, r.units, openHours, f.days);
    totalUnits += r.units;
    totalMinutes += minutes;
    const t = nameById.get(String(r._id)) || {};
    return {
      name: t.name || 'Unknown', category: t.category || '', units: r.units,
      usedHours: rules.round1(minutes / 60), capacityHours: u.capacityHours, utilizationPercent: u.percent,
    };
  }).sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const overall = rules.utilizationPercent(totalMinutes, totalUnits, openHours, f.days);
  return {
    rows, total: rows.length,
    summary: { overallPercent: overall.percent, openHoursPerDay: openHours, days: f.days, units: totalUnits },
  };
}

// ---------- 3. idle units ----------
async function idle(f, { skip, limit }) {
  const since = new Date(Date.now() - f.idleDays * rules.DAY_MS);
  const usedIds = await UsageSession.distinct('unit', { approvedAt: { $gte: since }, unit: { $ne: null } });
  const filter = { _id: { $nin: usedIds }, status: { $nin: ['RETIRED', 'LOST'] } };
  const types = await allowedTypeIds(f);
  if (types) filter.type = { $in: types };

  const [units, total] = await Promise.all([
    EquipmentUnit.find(filter).sort({ unitCode: 1 }).skip(skip).limit(limit).populate('type', 'name category').lean(),
    EquipmentUnit.countDocuments(filter),
  ]);
  const last = await UsageSession.aggregate([
    { $match: { unit: { $in: units.map((u) => u._id) }, approvedAt: { $ne: null } } },
    { $group: { _id: '$unit', lastUsedAt: { $max: '$approvedAt' } } },
  ]);
  const lastById = new Map(last.map((r) => [String(r._id), r.lastUsedAt]));
  const rows = units.map((u) => ({
    unitCode: u.unitCode, typeName: u.type ? u.type.name : '', category: u.type ? u.type.category || '' : '',
    status: u.status, lastUsedAt: lastById.get(String(u._id)) || null,
  }));
  return { rows, total, summary: { idleDays: f.idleDays, idleUnits: total } };
}

// ---------- 4. damage ----------
async function damage(f) {
  const types = await allowedTypeIds(f);
  const users = await allowedUserIds(f);
  const reportMatch = { createdAt: { $gte: f.from, $lt: f.to } };
  if (users) reportMatch.reportedBy = { $in: users };

  const withUnit = [
    { $match: reportMatch },
    { $lookup: { from: 'equipmentunits', localField: 'unit', foreignField: '_id', as: 'un' } },
    { $unwind: '$un' },
    ...(types ? [{ $match: { 'un.type': { $in: types } } }] : []),
  ];

  const issueMatch = { ...(await sessionMatch(f)), status: { $in: APPROVED } };
  const [byType, byUnit, issues] = await Promise.all([
    DamageReport.aggregate([
      ...withUnit,
      { $group: {
        _id: '$un.type', reports: { $sum: 1 },
        damages: { $sum: { $cond: [{ $eq: ['$type', 'DAMAGE'] }, 1, 0] } },
        losses: { $sum: { $cond: [{ $eq: ['$type', 'LOSS'] }, 1, 0] } },
      } },
      ...lookupType,
    ]),
    DamageReport.aggregate([
      ...withUnit,
      { $group: { _id: '$un.unitCode', reports: { $sum: 1 } } },
      { $sort: { reports: -1, _id: 1 } },
      { $limit: 10 },
    ]),
    UsageSession.aggregate([{ $match: issueMatch }, { $group: { _id: '$type', issues: { $sum: 1 } } }]),
  ]);
  const issuesByType = new Map(issues.map((r) => [String(r._id), r.issues]));
  const rows = byType.map((r) => {
    const n = issuesByType.get(String(r._id)) || 0;
    return {
      name: r.t.name, category: r.t.category || '', reports: r.reports, damages: r.damages,
      losses: r.losses, issues: n, ratePercent: rules.percent(r.reports, n),
    };
  }).sort((a, b) => b.reports - a.reports);
  return { rows, total: rows.length, summary: { topUnits: byUnit.map((u) => ({ unitCode: u._id, reports: u.reports })) } };
}

// ---------- 5. late returns ----------
async function late(f, page) {
  const base = { ...(await sessionMatch(f)), status: 'RETURNED' };
  const [overall] = await UsageSession.aggregate([
    { $match: base },
    { $group: {
      _id: null, returns: { $sum: 1 },
      lateReturns: { $sum: { $cond: ['$wasLate', 1, 0] } },
      lateMinutes: { $sum: { $cond: ['$wasLate', '$lateMinutes', 0] } },
    } },
  ]);
  const s = overall || { returns: 0, lateReturns: 0, lateMinutes: 0 };

  const out = await runPaged(UsageSession, [
    { $match: { ...base, wasLate: true } },
    { $group: { _id: '$user', lateCount: { $sum: 1 }, totalLateMinutes: { $sum: '$lateMinutes' } } },
    ...lookupUser,
    { $project: { _id: 1, name: '$u.name', srn: '$u.srn', department: '$u.department', lateCount: 1, totalLateMinutes: 1 } },
  ], { lateCount: -1, totalLateMinutes: -1 }, page);

  const rows = out.rows.map((r) => ({
    name: r.name, srn: r.srn || '', department: r.department || '', lateCount: r.lateCount,
    totalLateMinutes: r.totalLateMinutes, avgLateMinutes: rules.round1(r.totalLateMinutes / r.lateCount),
  }));
  return {
    rows, total: out.total,
    summary: {
      returns: s.returns, lateReturns: s.lateReturns,
      onTimePercent: s.returns ? rules.percent(s.returns - s.lateReturns, s.returns) : 0,
      avgLateMinutes: s.lateReturns ? rules.round1(s.lateMinutes / s.lateReturns) : 0,
    },
  };
}

// ---------- 6. sessions per student ----------
async function students(f, page) {
  const match = { ...(await sessionMatch(f)), status: { $in: APPROVED } };
  const out = await runPaged(UsageSession, [
    { $match: match },
    { $group: {
      _id: '$user', sessions: { $sum: 1 }, minutes: { $sum: minutesOf },
      lateReturns: { $sum: { $cond: ['$wasLate', 1, 0] } },
    } },
    ...lookupUser,
    { $project: { _id: 1, name: '$u.name', srn: '$u.srn', department: '$u.department', year: '$u.year', sessions: 1, minutes: 1, lateReturns: 1 } },
  ], { sessions: -1 }, page);
  const rows = out.rows.map((r) => ({
    name: r.name, srn: r.srn || '', department: r.department || '', year: r.year || '',
    sessions: r.sessions, hours: rules.round1(r.minutes / 60), lateReturns: r.lateReturns,
  }));
  return { rows, total: out.total, summary: null };
}

// ---------- 7. departments ----------
async function departments(f, page) {
  const match = { ...(await sessionMatch(f)), status: { $in: APPROVED } };
  const out = await runPaged(UsageSession, [
    { $match: match },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $group: {
      _id: { department: { $ifNull: ['$u.department', 'Unknown'] }, year: { $ifNull: ['$u.year', ''] } },
      sessions: { $sum: 1 }, minutes: { $sum: minutesOf }, students: { $addToSet: '$user' },
    } },
  ], { sessions: -1 }, page);
  const rows = out.rows.map((r) => ({
    department: r._id.department, year: r._id.year, students: r.students.length,
    sessions: r.sessions, hours: rules.round1(r.minutes / 60),
  }));
  return { rows, total: out.total, summary: null };
}

// ---------- 8. peak hours ----------
async function peakHours(f) {
  const match = await sessionMatch(f, 'requestedAt');
  const res = await UsageSession.aggregate([
    { $match: match },
    { $group: { _id: { $hour: { date: '$requestedAt', timezone: TIMEZONE } }, requests: { $sum: 1 } } },
  ]);
  const byHour = new Map(res.map((r) => [r._id, r.requests]));
  const rows = Array.from({ length: 24 }, (_, h) => ({
    hour: h, label: `${String(h).padStart(2, '0')}:00`, requests: byHour.get(h) || 0,
  }));
  const busiest = rows.reduce((a, b) => (b.requests > a.requests ? b : a), rows[0]);
  return { rows, total: 24, summary: { busiestHour: busiest.requests ? busiest.label : null } };
}

module.exports = { usageByType, utilization, idle, damage, late, students, departments, peakHours };
