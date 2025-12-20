import { ValidationError } from '../errors/ValidationError.js';
import { validator } from '../utils/validator.js';

export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      const data = {
        ...req.body,
        ...req.params,
        ...req.query,
      };

      const validated = await validator.validate(schema, data);
      
      // Replace request data with validated data
      req.validated = validated;
      
      next();
    } catch (error) {
      if (error.name === 'ValidationError') {
        next(new ValidationError('Validation failed', error.errors));
      } else {
        next(error);
      }
    }
  };
};

export const validateFile = (options = {}) => {
  return (req, res, next) => {
    if (!req.file && options.required) {
      return next(new ValidationError('File is required'));
    }

    if (req.file) {
      const { maxSize, allowedTypes } = options;
      
      if (maxSize && req.file.size > maxSize) {
        return next(new ValidationError(`File size exceeds ${maxSize} bytes`));
      }

      if (allowedTypes && !allowedTypes.includes(req.file.mimetype)) {
        return next(new ValidationError(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`));
      }
    }

    next();
  };
};