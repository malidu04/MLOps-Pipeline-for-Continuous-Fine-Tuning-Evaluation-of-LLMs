import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../core/utils/logger.js';

const redisClient = new Redis(config.redis);

redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('error', (error) => {
  logger.error('Redis client error:', error);
});

redisClient.on('close', () => {
  logger.warn('Redis client connection closed');
});

redisClient.on('reconnecting', () => {
  logger.info('Redis client reconnecting');
});

// Helper methods
export const cache = {
  set: async (key, value, ttl = 3600) => {
    const serialized = JSON.stringify(value);
    await redisClient.setex(key, ttl, serialized);
  },
  
  get: async (key) => {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  },
  
  del: async (key) => {
    await redisClient.del(key);
  },
  
  exists: async (key) => {
    const result = await redisClient.exists(key);
    return result === 1;
  },
  
  incr: async (key) => {
    return redisClient.incr(key);
  },
  
  decr: async (key) => {
    return redisClient.decr(key);
  },
  
  ttl: async (key) => {
    return redisClient.ttl(key);
  },
  
  flush: async () => {
    await redisClient.flushdb();
  },
};

export default redisClient;