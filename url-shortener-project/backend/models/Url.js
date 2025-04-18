const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UrlSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true }, // Ensure this is required
  shortId: { type: String, required: true, unique: true },
  customAlias: { type: String },
  password: { type: String },
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// Pre-save hook to hash the password before saving
UrlSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Url', UrlSchema);
// This code defines a Mongoose schema for a URL shortening service. It includes fields for the original URL, a short ID, an optional custom alias, an optional password for access control, an expiration date, and the creation date. The model is then exported for use in other parts of the application.
// The schema is designed to be flexible, allowing for various features such as custom aliases and password protection, while also tracking when each URL was created and when it expires.
// This structure is useful for building a URL shortening service that can handle different use cases, including temporary links and secure access.