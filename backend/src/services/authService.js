import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { User } from '../database/models/index.js';
import { AppError } from '../core/errors/AppError.js';
import { eventEmitter } from '../core/events/EventEmitter.js';
import { EVENT_TYPES } from '../core/events/eventTypes.js';
import { generateApiKey } from '../core/utils/encryption.js';
import logger from '../core/utils/logger.js';

class AuthService {
  async register(userData) {
    try {
      const existingUser = await User.findOne({ where: { email: userData.email } });
      if (existingUser) {
        throw new AppError('Email already registered', 400);
      }

      const user = await User.create({
        ...userData,
        apiKey: generateApiKey(),
      });

      // Emit user registered event
      eventEmitter.emit(EVENT_TYPES.USER_REGISTERED, user);

      const token = this.generateToken(user);
      
      return {
        user: user.toJSON(),
        token,
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  async login(email, password) {
    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        throw new AppError('Invalid credentials', 401);
      }

      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        throw new AppError('Invalid credentials', 401);
      }

      if (user.status !== 'active') {
        throw new AppError('Account is not active', 401);
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      const token = this.generateToken(user);

      // Emit login event
      eventEmitter.emit(EVENT_TYPES.USER_LOGIN, user);

      return {
        user: user.toJSON(),
        token,
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  async validateApiKey(apiKey) {
    try {
      const user = await User.findOne({ where: { apiKey } });
      if (!user || user.status !== 'active') {
        return null;
      }
      return user;
    } catch (error) {
      logger.error('API key validation error:', error);
      return null;
    }
  }

  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.environment.jwtSecret,
      { expiresIn: config.environment.jwtExpiresIn }
    );
  }

  async refreshToken(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return this.generateToken(user);
  }

  async updateProfile(userId, updateData) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const allowedUpdates = ['firstName', 'lastName', 'company', 'preferences'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    await user.update(updates);
    return user.toJSON();
  }

  async regenerateApiKey(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.apiKey = generateApiKey();
    await user.save();
    
    return { apiKey: user.apiKey };
  }
}

export default new AuthService();