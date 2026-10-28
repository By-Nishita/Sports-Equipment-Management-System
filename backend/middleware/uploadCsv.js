const multer = require('multer');
const { fail } = require('../utils/http');

// Memory storage: the CSV is read straight from memory, never saved on disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 } // 5000 students is far below 2 MB
}).single('file');

// Browsers report CSV files as text/csv, application/vnd.ms-excel (Windows Excel) or text/plain.
const isCsv = (file) => /\.csv$/i.test(file.originalname || '') || /csv|excel|text\/plain/i.test(file.mimetype || '');

module.exports = (req, res, next) =>
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return fail(res, 400, 'The file must be 2 MB or smaller');
      return fail(res, 400, 'Upload one CSV file in the "file" field');
    }
    if (req.file && !isCsv(req.file)) return fail(res, 400, 'The file must be a .csv file');
    next();
  });
