const settingsService = require('../services/settingsService');
const auditService = require('../services/auditService');

const getSettings = async (req, res) => {
  try {
    const settings = await settingsService.get();
    res.json({ success: true, settings });
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const beforeValues = (await settingsService.get()).toObject();
    const settings = await settingsService.update(req.body || {});

    // Record exactly what changed: old value -> new value
    const changed = {};
    settingsService.EDITABLE.forEach((f) => {
      if (beforeValues[f] !== settings[f]) changed[f] = { from: beforeValues[f], to: settings[f] };
    });
    await auditService.log({
      actor: req.user._id,
      action: 'SETTINGS_UPDATED',
      entityType: 'Settings',
      entityId: settings._id,
      meta: changed
    });

    res.json({ success: true, message: 'Settings saved', settings });
  } catch (err) {
    if (err.status === 400 || err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('updateSettings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSettings, updateSettings };