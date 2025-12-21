import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../../database/redisClient.js';
import config from '../../config/index.js';

const createLimiter = (options = {}) => {
    const {
        windowMs = config.environment.rateLimitWindow,
        max = config.environment.rateLimitMax,
        keyGenerator = (req) => req.ip,
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
            sendCommand: (...args) => rediaClient.call(...args),
            prefix: 'rate-limit:',
        }),
        standardHeaders: true,
        legacyHeaders: false,
    });
};

export const apiLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    skip: (req) => req.user?.role === 'admin',
});

export const authLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.body.email || req.ip,
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