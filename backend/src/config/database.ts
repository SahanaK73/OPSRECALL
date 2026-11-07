import mongoose from 'mongoose';
import { getEnv } from './env';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(getEnv().MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection failed. Check MONGODB_URI and Atlas IP allow-list (Network Access).', err);
    throw err;
  }
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
}

export const isDatabaseConnected = () => mongoose.connection.readyState === 1;
