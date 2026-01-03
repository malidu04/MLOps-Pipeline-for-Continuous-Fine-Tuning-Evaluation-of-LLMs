import { 
  sequelize, 
  testConnection as testDbConnection,
  syncDatabase,
  checkDatabaseHealth,
  closeConnection,
  getModelStatistics,
  User,
  ModelVersion,
  TrainingJob,
  Evaluation,
  Deployment,
  AuditLog,
  db,
  MODEL_STATUS,
  TRAINING_STATUS,
  DEPLOYMENT_STATUS,
  EVALUATION_STATUS,
  USER_ROLES,
  USER_STATUS,
} from './models/index.js';

import { Sequelize } from 'sequelize'; // Import Sequelize directly
import config from '../config/index.js';
import logger from '../core/utils/logger.js';

// Re-export everything from models
export {
  sequelize,
  testDbConnection as testConnection,
  syncDatabase,
  checkDatabaseHealth,
  closeConnection,
  getModelStatistics,
  User,
  ModelVersion,
  TrainingJob,
  Evaluation,
  Deployment,
  AuditLog,
  db,
  MODEL_STATUS,
  TRAINING_STATUS,
  DEPLOYMENT_STATUS,
  EVALUATION_STATUS,
  USER_ROLES,
  USER_STATUS,
  Sequelize, // Export Sequelize
};

// Initialize database connection
export const initializeDatabase = async () => {
  try {
    await testDbConnection();
    logger.info('✅ Database connection established successfully.');
    
    // Sync models based on environment
    if (config.environment.isDevelopment || config.environment.isTest) {
      await syncDatabase({ alter: true });
      logger.info('✅ Database models synchronized.');
    }
    
    return true;
  } catch (error) {
    logger.error('❌ Unable to connect to the database:', error);
    throw error;
  }
};

// Database health check endpoint
export const databaseHealthCheck = async () => {
  return checkDatabaseHealth();
};

// Seed database with initial data
export const seedDatabase = async () => {
  try {
    logger.info('Starting database seeding...');
    
    // Check if admin user already exists
    const adminExists = await User.findOne({ where: { email: 'admin@mlplatform.com' } });
    
    if (!adminExists) {
      // Create admin user
      const adminUser = await User.create({
        email: 'admin@mlplatform.com',
        password: 'Admin123!', // In production, use environment variable
        firstName: 'Admin',
        lastName: 'User',
        role: USER_ROLES.ADMIN,
        company: 'ML Platform',
        status: USER_STATUS.ACTIVE,
      });
      
      logger.info(`✅ Admin user created: ${adminUser.email}`);
      
      // Create sample models for admin
      const sampleModels = [
        {
          name: 'Sentiment Analysis Model',
          description: 'Analyzes text sentiment for customer reviews',
          baseModel: 'gpt-4',
          taskType: 'classification',
          parameters: {
            maxTokens: 500,
            temperature: 0.7,
          },
          tags: ['sentiment', 'nlp', 'classification'],
          userId: adminUser.id,
        },
        {
          name: 'Sales Forecasting Model',
          description: 'Predicts future sales based on historical data',
          baseModel: 'custom',
          taskType: 'regression',
          parameters: {
            lookbackPeriod: 30,
            forecastHorizon: 7,
          },
          tags: ['forecasting', 'time-series', 'regression'],
          userId: adminUser.id,
        },
      ];
      
      for (const modelData of sampleModels) {
        await ModelVersion.create(modelData);
      }
      
      logger.info('✅ Sample models created');
    }
    
    logger.info('✅ Database seeding completed successfully');
    return true;
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    throw error;
  }
};

// Cleanup old data
export const cleanupOldData = async (days = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Cleanup old audit logs
    const deletedAuditLogs = await AuditLog.destroy({
      where: {
        createdAt: { [Sequelize.Op.lt]: cutoffDate },
      },
      force: true,
    });
    
    logger.info(`✅ Cleaned up ${deletedAuditLogs} old audit logs`);
    
    return {
      deletedAuditLogs,
    };
  } catch (error) {
    logger.error('❌ Cleanup failed:', error);
    throw error;
  }
};

// Database backup helper (conceptual - implement actual backup based on your setup)
export const backupDatabase = async () => {
  try {
    logger.info('Starting database backup...');
    
    // This is a conceptual implementation
    // In production, you would:
    // 1. Use pg_dump for PostgreSQL
    // 2. Upload to S3/cloud storage
    // 3. Store backup metadata
    
    const backupInfo = {
      timestamp: new Date().toISOString(),
      database: config.database.database,
      tables: await getModelStatistics(),
      estimatedSize: '0 MB', // You would calculate actual size
    };
    
    logger.info('✅ Database backup initiated');
    return backupInfo;
  } catch (error) {
    logger.error('❌ Database backup failed:', error);
    throw error;
  }
};

// Export default for convenience
export default {
  sequelize,
  initializeDatabase,
  testConnection: testDbConnection,
  databaseHealthCheck,
  seedDatabase,
  cleanupOldData,
  backupDatabase,
  User,
  ModelVersion,
  TrainingJob,
  Evaluation,
  Deployment,
  AuditLog,
  MODEL_STATUS,
  TRAINING_STATUS,
  DEPLOYMENT_STATUS,
  EVALUATION_STATUS,
  USER_ROLES,
  USER_STATUS,
  Sequelize,
};