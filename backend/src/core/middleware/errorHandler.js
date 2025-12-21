import config from '../../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../errors/AppError.js';

export const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    logger.error(`${err.statusCode} - ${err.message}`, {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        stack: req.stack,
        user: req.user?.id,
    });

    if (config.environment.isDevelopment) {
        return res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack,
        });
    }

    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    }

    logger.error('💥 UNEXPECTED ERROR:', err);
    return res.status(500).json({
        status: 'error',
        message: 'Something went wrong!',
    });
};

export const notFoundHandler = (req, res, next) => {
    const error = new AppError(`Cannot ${req.method} ${req.originalUrl}`, 401);
    next(error);
};