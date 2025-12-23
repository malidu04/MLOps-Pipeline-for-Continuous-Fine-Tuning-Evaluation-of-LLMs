import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { User } from '../database/models/User.js';
import { AppError } from '../core/errors/AppError.js';
import { eventEmitter } from '../core/events/EventEmitter.js';
import { EVENT_TYPES } from '../core/events/eventTypes.js';
import { generateApiKey } from '../core/utils/encryption.js';
import logger from '../core/utils/logger.js';

class AutgService {
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

            eventEmitter.removeListener(EVENT_TYPES.USER_REGISTERED, user);
            const token = this.generateToken(user);

            return {
                user: user.toJSON(),
                token,
            };
        } catch (error) {
            logger.error('Registration Error:', error);
            throw error;
        }
    }

    async login(email, password) {
        try {
            const user = await User.findOne({ where: { email } });
            if (!user) {
                throw new AppError('Invalid Credentials', 401);
            }

            const isValidPassword = await user.validatePassword(password);
            if (!isValidPassword) {
                throw new AppError('Invalid Credentials', 401);
            }

            if (user.status !== 'active') {
                throw new AppError('Account is not active', 401);
            }

            user.lastLogin = new Date();
            await user.save();

            const token = this.generateToken(user);

            eventEmitter.emit(EVENT_TYPES.USER_LOGIN, user);

            return {
                user: user.toJSON(),
                token,
            };
        } catch (error) {
            logger.error('Login Error:', error);
            throw error;
        }
    }
}