import authService from '../services/authService.js';
import { schemas } from '../core/utils/validator.js';
import { AppError } from '../core/errors/AppError.js';
import logger from '../core/utils/logger.js';

class AuthController {
  async register(req, res, next) {
    try {
      const userData = req.validated;
      const result = await authService.register(userData);
      
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.validated;
      const result = await authService.login(email, password);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      res.json({
        success: true,
        data: req.user,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const updatedUser = await authService.updateProfile(req.user.id, req.body);
      
      res.json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const token = await authService.refreshToken(req.user.id);
      
      res.json({
        success: true,
        data: { token },
      });
    } catch (error) {
      next(error);
    }
  }

  async regenerateApiKey(req, res, next) {
    try {
      const result = await authService.regenerateApiKey(req.user.id);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async validateApiKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) {
        throw new AppError('API key required', 401);
      }

      const user = await authService.validateApiKey(apiKey);
      if (!user) {
        throw new AppError('Invalid API key', 401);
      }

      res.json({
        success: true,
        data: {
          user: user.toJSON(),
          scopes: ['models:read', 'models:write', 'training:read'],
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();