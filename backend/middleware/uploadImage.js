const multer = require('multer');
const { fail } = require('../utils/http');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

// Memory storage: the file goes straight to sharp then Cloudinary, never to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'photo'));
  },
}).single('photo');

// Turns multer errors into the usual { success, message, data } 400 instead of a stack trace.
module.exports = (req, res, next) =>
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return fail(res, 400, 'Photo must be 5 MB or smaller');
    return fail(res, 400, 'Upload a single JPG, PNG or WebP file in the "photo" field');
  });
