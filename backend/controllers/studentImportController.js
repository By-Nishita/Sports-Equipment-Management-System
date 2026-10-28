const importService = require("../services/studentImportService");
const userService = require("../services/userService");
const { ok, handle } = require("../utils/http");

// POST /api/users/import/dry-run   (admin, multipart field "file"): counts only, changes nothing
const dryRun = handle(async (req, res) => {
  ok(res, await importService.dryRun(req.file && req.file.buffer), "File checked");
});

// POST /api/users/import   (admin, multipart field "file")
const runImport = handle(async (req, res) => {
  const result = await importService.runImport(req.user, req.file && req.file.buffer, req.file && req.file.originalname);
  ok(res, result, `Import finished: ${result.created} new, ${result.updated} updated`);
});

// PATCH /api/users/:id   { isActive?, role? }   (admin)
const updateUser = handle(async (req, res) => {
  ok(res, await userService.updateUser(req.user, req.params.id, req.body), "User updated");
});

module.exports = { dryRun, runImport, updateUser };
