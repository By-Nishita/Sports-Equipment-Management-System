const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const { HttpError } = require('../utils/http');

const FOLDER = 'sports-equipment/types';

function configure() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new HttpError(503, 'Photo storage is not configured');
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Resize with sharp and convert to WebP. Nothing is stored in MongoDB or on disk.
const toWebp = (buffer, width) =>
  sharp(buffer).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();

const uploadBuffer = (buffer, publicId) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: FOLDER, public_id: publicId, overwrite: true, resource_type: 'image' }, (err, result) =>
        err ? reject(err) : resolve(result)
      )
      .end(buffer);
  });

/** Returns { imageUrl (800 px wide WebP), thumbUrl (200 px wide WebP) }. */
async function uploadTypePhoto(buffer, typeId) {
  configure();
  let main;
  let thumb;
  try {
    [main, thumb] = await Promise.all([toWebp(buffer, 800), toWebp(buffer, 200)]);
  } catch (_) {
    throw new HttpError(400, 'That file is not a readable image');
  }
  const [a, b] = await Promise.all([uploadBuffer(main, `${typeId}-main`), uploadBuffer(thumb, `${typeId}-thumb`)]);
  // Cache-bust so a replaced photo shows up immediately (same public_id is reused).
  const v = Date.now();
  return { imageUrl: `${a.secure_url}?v=${v}`, thumbUrl: `${b.secure_url}?v=${v}` };
}

module.exports = { uploadTypePhoto, toWebp };
