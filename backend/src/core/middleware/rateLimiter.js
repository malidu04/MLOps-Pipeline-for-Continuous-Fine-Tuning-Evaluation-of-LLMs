import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../../database/redisClient.js';
import config from '../../config/index.js';

// Helper function to safely extract identifier for rate limiting
const getSafeIdentifier = (req) => {
  // Try to get email from body for auth requests
  if (req.body && req.body.email) {
    return req.body.email;
  }
  
  // Use the built-in ipKeyGenerator for IP-based rate limiting
  return ipKeyGenerator(req);
};

const createLimiter = (options = {}) => {
  const {
    windowMs = config.environment.rateLimitWindow,
    max = config.environment.rateLimitMax,
    keyGenerator = getSafeIdentifier, // Use our safe identifier generator
    skip = (req) => false,
    message = 'Too many requests, please try again later.',
  } = options;

  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    skip,
    message,
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'rate_limit:',
    }),
    standardHeaders: true,
    legacyHeaders: false,
  });
};

export const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  skip: (req) => req.user?.role === 'admin',
});

export const authLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req) => {
    // For auth requests, use email if available, otherwise use IP
    return req.body?.email || ipKeyGenerator(req);
  },
  message: 'Too many login attempts, please try again after an hour.',
});

export const trainingLimiter = createLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10,
  skip: (req) => req.user?.role === 'admin',
});

export const deploymentLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  skip: (req) => req.user?.role === 'admin',
});