import express from 'express';
import authController from '../controllers/authController.js';
import { validate } from '../core/middleware/validation.js';
import { schemas } from '../core/utils/validator.js';
import { authLimiter, apiLimiter } from '../core/middleware/rateLimiter.js';
import { authenticate, optionalAuth } from '../core/middleware/auth.js';

const router = express.Router(); // Use express.Router()

// Public routes
router.post('/register',
  authLimiter,
  validate(schemas.register),
  authController.register
);

router.post('/login',
  authLimiter,
  validate(schemas.login),
  authController.login
);

router.post('/validate-api-key',
  apiLimiter,
  authController.validateApiKey
);

// Protected routes
router.get('/profile',
  authenticate,
  authController.getProfile
);

router.put('/profile',
  authenticate,
  authController.updateProfile
);

router.post('/refresh-token',
  authenticate,
  authController.refreshToken
);

router.post('/regenerate-api-key',
  authenticate,
  authController.regenerateApiKey
);

export default router;