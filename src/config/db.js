import mongoose from 'mongoose';
import { config } from './env.js';

let memoryServerInstance = null;

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 2500
    });
    console.log(`[Database] MongoDB connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      try {
        console.warn(`[Database Warning] Local MongoDB not reachable at ${config.mongodbUri}. Launching in-memory MongoDB for local development...`);
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        memoryServerInstance = await MongoMemoryServer.create();
        const memoryUri = memoryServerInstance.getUri();
        const conn = await mongoose.connect(memoryUri, {
          autoIndex: true
        });
        console.log(`[Database] In-memory MongoDB connected successfully at ${memoryUri}`);
        return conn;
      } catch (memErr) {
        console.error('[Database Error] Failed to launch in-memory MongoDB fallback:', memErr.message);
      }
    }

    console.error(`[Database Error] MongoDB connection failed: ${error.message}`);
    // Don't exit immediately in non-production test setups, but rethrow
    throw error;
  }
};

export const closeDB = async () => {
  await mongoose.connection.close(false);
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
    memoryServerInstance = null;
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB disconnected.');
});

mongoose.connection.on('error', (err) => {
  console.error('[Database Error]', err);
});

