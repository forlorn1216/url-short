/**
 * URL Shortener Server Entry Point
 * 
 * This loads the main server implementation from the backend folder.
 * 
 * IMPORTANT: Before running in production, make sure:
 * 1. MongoDB is installed and running on the server OR
 * 2. The MONGO_URI in .env points to a valid MongoDB instance (like MongoDB Atlas)
 */

// Set up better error logging
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Load the actual server implementation
require('./backend/server.js');