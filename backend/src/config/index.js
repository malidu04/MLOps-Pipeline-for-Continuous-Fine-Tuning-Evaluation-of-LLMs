import databaseConfig from './database.js';
import openaiConfig from './openai.js';
import redisConfig from './redis.js';
import awsConfig from './aws.js';
import environment from './environment.js';

export default {
    database: databaseConfig,
    openai: openaiConfig,
    redis: redisConfig,
    aws: awsConfig,
    environment,
    server: {
        port: process.env.PORT || 3000,
        nodeEnv: process.env.NODE_ENV || 'development',
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    }
};