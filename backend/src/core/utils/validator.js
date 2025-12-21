import Joi from 'joi';

const customMessages = {
  'string.empty': '{{#label}} is required',
  'any.required': '{{#label}} is required',
  'string.email': 'Please provide a valid email address',
  'string.min': '{{#label}} must be at least {{#limit}} characters',
  'string.max': '{{#label}} must not exceed {{#limit}} characters',
  'number.min': '{{#label}} must be at least {{#limit}}',
  'number.max': '{{#label}} must not exceed {{#limit}}',
};

export const schemas = {
  // Auth Schemas
  register: Joi.object({
    email: Joi.string().email().required().label('Email'),
    password: Joi.string().min(8).required().label('Password'),
    firstName: Joi.string().min(2).max(50).required().label('First Name'),
    lastName: Joi.string().min(2).max(50).required().label('Last Name'),
    company: Joi.string().max(100).optional().label('Company'),
  }).messages(customMessages),

  login: Joi.object({
    email: Joi.string().email().required().label('Email'),
    password: Joi.string().required().label('Password'),
  }).messages(customMessages),

  // Model Schemas
  createModel: Joi.object({
    name: Joi.string().min(3).max(100).required().label('Model Name'),
    description: Joi.string().max(500).optional().label('Description'),
    baseModel: Joi.string().required().label('Base Model'),
    taskType: Joi.string().valid('classification', 'regression', 'generation').required().label('Task Type'),
    parameters: Joi.object().optional().label('Parameters'),
  }).messages(customMessages),

  // Training Schemas
  createTraining: Joi.object({
    modelId: Joi.string().uuid().required().label('Model ID'),
    datasetId: Joi.string().uuid().required().label('Dataset ID'),
    hyperparameters: Joi.object().required().label('Hyperparameters'),
    epochs: Joi.number().min(1).max(100).required().label('Epochs'),
    batchSize: Joi.number().min(1).max(1024).required().label('Batch Size'),
  }).messages(customMessages),

  // Evaluation Schemas
  createEvaluation: Joi.object({
    modelId: Joi.string().uuid().required().label('Model ID'),
    datasetId: Joi.string().uuid().required().label('Dataset ID'),
    metrics: Joi.array().items(Joi.string()).optional().label('Metrics'),
  }).messages(customMessages),

  // Deployment Schemas
  createDeployment: Joi.object({
    modelId: Joi.string().uuid().required().label('Model ID'),
    environment: Joi.string().valid('development', 'staging', 'production').required().label('Environment'),
    scalingConfig: Joi.object({
      minInstances: Joi.number().min(1).max(10).required(),
      maxInstances: Joi.number().min(1).max(100).required(),
    }).optional().label('Scaling Configuration'),
  }).messages(customMessages),
};

export const validate = async (schema, data) => {
  try {
    const value = await schema.validateAsync(data, {
      abortEarly: false,
      stripUnknown: true,
    });
    return value;
  } catch (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';
    validationError.errors = errors;
    
    throw validationError;
  }
};

export const validator = { schemas, validate };
export default validator;