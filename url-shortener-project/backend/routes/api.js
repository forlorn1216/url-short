const express = require('express');
const router = express.Router();
const Url = require('../models/Url');
const Click = require('../models/Click');
const shortid = require('shortid');
const generateQRCode = require('../utils/generateQRCode');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const UAParser = require('ua-parser-js');
const { Parser } = require('json2csv');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// Log all requests to help with debugging
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// API ping test to verify server is working
router.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// API route to shorten URL
router.post('/api/shorten', async (req, res) => {
  const { originalUrl, customAlias, password, expiresAt } = req.body;
  const shortId = customAlias || shortid.generate();

  const existing = await Url.findOne({ shortId });
  if (existing && customAlias) {
    console.error(`Alias conflict: ${shortId} is already in use.`);
    return res.status(409).json({ error: `Alias '${shortId}' is already in use. Please choose a different alias.` });
  }

  const url = new Url({
    originalUrl,
    shortId,
    customAlias,
    password,
    expiresAt
  });

  await url.save();

  const qrCode = await generateQRCode(`${process.env.BASE_URL}/${shortId}`);
  res.json({ shortUrl: `${process.env.BASE_URL}/${shortId}`, qrCode });
});

// Enhanced analytics endpoint
router.get('/api/analytics/:shortId', async (req, res) => {
  const { shortId } = req.params;

  try {
    // Fetch the URL to get creation timestamp
    const url = await Url.findOne({ shortId });
    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }

    // Fetch all clicks for the given shortId
    const clicks = await Click.find({ shortId });

    // Total clicks count
    const totalClicks = clicks.length;
    
    // Link creation timestamp
    const createdAt = url.createdAt;

    // Group clicks by date
    const clicksByDate = clicks.reduce((acc, click) => {
      const date = new Date(click.timestamp).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    // Group clicks by hour
    const clicksByHour = clicks.reduce((acc, click) => {
      const hour = new Date(click.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    // Group clicks by location - ensure no undefined values
    const locationStats = clicks.reduce((acc, click) => {
      const location = click.location || 'Unknown';
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});

    // Group clicks by device - ensure no undefined values
    const deviceStats = clicks.reduce((acc, click) => {
      const device = click.device || 'Unknown Device';
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {});

    // Group clicks by referrer
    const referrerStats = clicks.reduce((acc, click) => {
      const referrer = click.referrer || 'Direct';
      acc[referrer] = (acc[referrer] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalClicks,
      createdAt,
      clicksByDate,
      clicksByHour,
      locationStats,
      deviceStats,
      referrerStats
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Export analytics as CSV
router.get('/api/analytics/:shortId/export', async (req, res) => {
  const { shortId } = req.params;

  try {
    const clicks = await Click.find({ shortId });

    const fields = ['timestamp', 'ip', 'location', 'device', 'userAgent', 'referrer'];
    const parser = new Parser({ fields });
    const csv = parser.parse(clicks);

    res.header('Content-Type', 'text/csv');
    res.attachment(`${shortId}_analytics.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to check if password is required
router.get('/:shortId/metadata', async (req, res) => {
  const { shortId } = req.params;
  console.log(`Fetching metadata for Short ID: ${shortId}`);

  try {
    const url = await Url.findOne({ shortId });

    if (!url) {
      console.error(`Metadata fetch failed. Short ID not found: ${shortId}`);
      return res.status(404).json({ error: 'Short ID not found' });
    }

    console.log(`Metadata fetched for Short ID: ${shortId}`, { requiresPassword: !!url.password });
    res.json({ requiresPassword: !!url.password });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Redirection route with click logging
router.get('/:shortId', async (req, res) => {
  const { shortId } = req.params;
  const { password } = req.query;

  console.log(`Redirection request received for shortId: "${shortId}"`);

  try {
    const url = await Url.findOne({ shortId });
    
    console.log(`Database lookup result: ${url ? 'URL found' : 'URL NOT FOUND'}`);
    
    if (!url) {
      console.error(`URL not found in database: "${shortId}"`);
      return res.status(404).send('URL not found');
    }

    if (url.expiresAt && new Date() > url.expiresAt) {
      console.error(`Link expired: ${shortId}`);
      return res.status(410).send('Link expired');
    }

    // Password validation
    if (url.password) {
      console.log(`Password protected URL: ${shortId}`);
      
      if (!password) {
        console.error(`No password provided for password-protected URL: ${shortId}`);
        return res.status(403).send('Password required');
      }

      try {
        const isMatch = password === url.password || await bcrypt.compare(password, url.password);
        console.log(`Password validation result: ${isMatch ? 'Success' : 'Failed'}`);
        
        if (!isMatch) {
          return res.status(403).send('Incorrect password');
        }
      } catch (error) {
        console.error(`Error comparing passwords: ${error.message}`);
        // If bcrypt.compare fails (e.g., stored password isn't hashed), fall back to direct comparison
        if (password !== url.password) {
          return res.status(403).send('Incorrect password');
        }
      }
    }

    const redirectUrl = url.originalUrl.startsWith('http://') || url.originalUrl.startsWith('https://')
      ? url.originalUrl
      : `http://${url.originalUrl}`;

    console.log(`Redirecting to: ${redirectUrl}`);

    // Log the click
    try {
      const parser = new UAParser(req.headers['user-agent']);
      const parsedUA = parser.getResult();
      const deviceInfo = `${parsedUA.browser.name || 'Unknown Browser'} on ${parsedUA.os.name || 'Unknown OS'}`;

      const ip = req.ip === '::1' ? '8.8.8.8' : req.ip; // fallback for localhost
      let location = 'Unknown';
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
        const geo = await geoRes.json();
        if (geo && geo.status === 'success') {
          location = `${geo.city}, ${geo.country}`;
        }
      } catch (err) {
        console.error('Geo IP lookup failed:', err);
      }

      const click = new Click({
        shortId,
        ip,
        location,
        device: deviceInfo,
        userAgent: req.headers['user-agent'],
        referrer: req.get('Referrer') || 'Direct'
      });
      await click.save();
      console.log(`Click logged for ${shortId}`);
    } catch (clickError) {
      console.error(`Error logging click: ${clickError.message}`);
      // Continue with redirection even if click logging fails
    }

    // Redirect the user
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error(`Error during redirection: ${error.message}`);
    return res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
