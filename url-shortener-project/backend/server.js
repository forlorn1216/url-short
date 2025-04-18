const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
app.use(cors());

console.log("MONGO_URI:", MONGO_URI);

// MongoDB connection setup
console.log("Attempting to connect to MongoDB with URI:", MONGO_URI);
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000 // Timeout after 5 seconds instead of default 30
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
  console.error('MongoDB connection failed:', err.message);
  console.error('Please check that:');
  console.error('1. MongoDB is installed and running on your server');
  console.error('2. The MONGO_URI in your .env file is correct');
  console.error('3. Network connectivity to MongoDB is available');
});

app.use(express.json());

// API routes 
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Special routes - MUST come BEFORE the shortID routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.get('/analytics.html', (req, res) => {
  console.log('Serving analytics.html directly');
  res.sendFile(path.join(__dirname, '..', 'client', 'analytics.html'));
});

app.get('/analytics', (req, res) => {
  res.redirect('/analytics.html');
});

// Serve static files - CSS, JS, etc.
app.use(express.static(path.join(__dirname, '..', 'client')));

// Handle shortURL routes - MUST come AFTER the special routes and static files
app.use('/', apiRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
