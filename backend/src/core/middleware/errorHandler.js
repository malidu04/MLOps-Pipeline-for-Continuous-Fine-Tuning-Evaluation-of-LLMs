import config from '../../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../errors/AppError.js';

export const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    
}