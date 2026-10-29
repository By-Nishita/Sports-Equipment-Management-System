const service = require('../services/reportService');
const rules = require('../services/reportRules');
const audit = require('../services/auditService');
const { toCsv } = require('../utils/csv');
const { ok, handle, HttpError, parsePage } = require('../utils/http');

const CSV_ROW_LIMIT = 5000;
// Reports that list individual students: every open is written to the audit log.
const SENSITIVE = new Set(['students', 'late']);

/** Builds one handler. `needsRange` is false only for the idle report (it uses ?days=). */
function makeReport(name, run, { needsRange = true } = {}) {
  return handle(async (req, res) => {
    const wantsCsv = req.query.format === 'csv';
    if (wantsCsv && req.user.role !== 'admin') throw new HttpError(403, 'Only an admin can download CSV');

    const filters = {
      type: req.query.type || '',
      category: req.query.category || '',
      department: req.query.department || '',
    };
    if (needsRange) Object.assign(filters, rules.parseRange(req.query));
    else {
      const d = parseInt(req.query.days, 10);
      filters.idleDays = Number.isFinite(d) ? Math.min(Math.max(d, 1), 365) : 30;
    }

    const page = wantsCsv ? { skip: 0, limit: CSV_ROW_LIMIT } : parsePage(req.query);
    const result = await run(filters, page);

    if (SENSITIVE.has(name) || wantsCsv) {
      await audit.log({
        actor: req.user._id,
        action: wantsCsv ? 'REPORT_EXPORTED' : 'REPORT_VIEWED',
        entityType: 'Report', entityId: name,
        meta: { from: req.query.from, to: req.query.to, type: filters.type, category: filters.category, department: filters.department },
      });
    }

    if (wantsCsv) {
      const stamp = needsRange ? `${req.query.from}_${req.query.to}` : `last-${filters.idleDays}-days`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${name}-${stamp}.csv"`);
      return res.send(`\uFEFF${toCsv(result.rows)}`);
    }

    return ok(res, result.rows, 'OK', 200, {
      summary: result.summary,
      pagination: { page: Math.floor(page.skip / page.limit) + 1, limit: page.limit, total: result.total, pages: Math.max(1, Math.ceil(result.total / page.limit)) },
    });
  });
}

module.exports = {
  usageByType: makeReport('usage-by-type', service.usageByType),
  utilization: makeReport('utilization', service.utilization),
  idle: makeReport('idle', service.idle, { needsRange: false }),
  damage: makeReport('damage', service.damage),
  late: makeReport('late', service.late),
  students: makeReport('students', service.students),
  departments: makeReport('departments', service.departments),
  peakHours: makeReport('peak-hours', service.peakHours),
};
