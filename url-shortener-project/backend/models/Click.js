const mongoose = require('mongoose');

const ClickSchema = new mongoose.Schema({
  shortId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  ip: String,
  location: { type: String, default: 'Unknown' },
  device: { type: String, default: 'Unknown Device' },
  userAgent: String,
  referrer: { type: String, default: 'Direct' }
});

module.exports = mongoose.model('Click', ClickSchema);