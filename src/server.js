import mongoose from 'mongoose';
import app from './app.js';
import { connectDB, closeDB } from './config/db.js';
import { config } from './config/env.js';

let server;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    server = app.listen(config.port, () => {
      console.log(`[Server] Buddy Tracker API running in ${config.nodeEnv} mode on http://localhost:${config.port}`);
      console.log(`[Server] Health check: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    console.error('[Server Error] Failed to bootstrap application:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Closing server gracefully...`);

  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      try {
        await closeDB();
        console.log('[Database] MongoDB connection closed.');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error while closing MongoDB connection:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception thrown:', err);
  process.exit(1);
});

startServer();
