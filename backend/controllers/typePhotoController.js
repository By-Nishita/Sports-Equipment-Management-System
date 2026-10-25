const mongoose = require('mongoose');
const EquipmentType = require('../models/EquipmentType');
const audit = require('../services/auditService');
const { uploadTypePhoto } = require('../services/photoService');
const { ok, handle, HttpError } = require('../utils/http');

// POST /api/equipment/types/:id/photo   (admin, multipart field "photo")
const uploadPhoto = handle(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
  if (!req.file) throw new HttpError(400, 'Upload a single JPG, PNG or WebP file in the "photo" field');

  const type = await EquipmentType.findById(req.params.id).select('_id name');
  if (!type) throw new HttpError(404, 'Equipment type not found');

  const { imageUrl, thumbUrl } = await uploadTypePhoto(req.file.buffer, type._id);
  const updated = await EquipmentType.findByIdAndUpdate(type._id, { $set: { imageUrl, thumbUrl } }, { new: true });

  await audit.log({
    actor: req.user._id, action: 'TYPE_PHOTO_UPLOADED', entityType: 'EquipmentType', entityId: type._id,
    meta: { name: type.name },
  });
  ok(res, { imageUrl: updated.imageUrl, thumbUrl: updated.thumbUrl }, 'Photo uploaded');
});

module.exports = { uploadPhoto };
