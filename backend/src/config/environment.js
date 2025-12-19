import dotenv from 'dotenv';

dotenv.config();

export default {
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10'),
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  mlPipelineUrl: process.env.ML_PIPELINE_URL || 'http://localhost:8000',
  websocketPort: parseInt(process.env.WEBSOCKET_PORT || '8080'),
};