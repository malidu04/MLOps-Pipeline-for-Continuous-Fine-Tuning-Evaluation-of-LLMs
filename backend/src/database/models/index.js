import { Sequelize, DataTypes } from 'sequelize';
import config from '../../config/index.js';
import logger from '../../core/utils/logger.js';


console.log('🔍 DB CONFIG USED BY SEQUELIZE:', {
  database: config.database.database,
  username: config.database.username,
  password: config.database.password,
  host: config.database.host,
  port: config.database.port,
});

// Create Sequelize instance
const sequelize = new Sequelize(
  config.database.database,
  config.database.username,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect || 'postgres',
    logging: false,
  }
);


// Import models
import UserModel from './User.js';
import ModelVersionModel from './ModelVersion.js';
import TrainingJobModel from './TrainingJob.js';
import EvaluationModel from './Evaluation.js';
import DeploymentModel from './Deployment.js';
import AuditLogModel from './AuditLog.js';

// Initialize models
const User = UserModel.init(sequelize, DataTypes);
const ModelVersion = ModelVersionModel.init(sequelize, DataTypes);
const TrainingJob = TrainingJobModel.init(sequelize, DataTypes);
const Evaluation = EvaluationModel.init(sequelize, DataTypes);
const Deployment = DeploymentModel.init(sequelize, DataTypes);
const AuditLog = AuditLogModel.init(sequelize, DataTypes);

// Define associations
const defineAssociations = () => {
  // User associations
  User.hasMany(ModelVersion, {
    foreignKey: 'userId',
    as: 'models',
    onDelete: 'CASCADE',
  });
  
  User.hasMany(TrainingJob, {
    foreignKey: 'userId',
    as: 'trainingJobs',
    onDelete: 'CASCADE',
  });
  
  User.hasMany(Evaluation, {
    foreignKey: 'userId',
    as: 'evaluations',
    onDelete: 'CASCADE',
  });
  
  User.hasMany(Deployment, {
    foreignKey: 'userId',
    as: 'deployments',
    onDelete: 'CASCADE',
  });
  
  User.hasMany(AuditLog, {
    foreignKey: 'userId',
    as: 'auditLogs',
    onDelete: 'SET NULL',
  });

  // ModelVersion associations
  ModelVersion.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
  });
  
  ModelVersion.hasMany(TrainingJob, {
    foreignKey: 'modelId',
    as: 'trainingJobs',
    onDelete: 'CASCADE',
  });
  
  ModelVersion.hasMany(Evaluation, {
    foreignKey: 'modelId',
    as: 'evaluations',
    onDelete: 'CASCADE',
  });
  
  ModelVersion.hasMany(Deployment, {
    foreignKey: 'modelId',
    as: 'deployments',
    onDelete: 'CASCADE',
  });

  // TrainingJob associations
  TrainingJob.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
  });
  
  TrainingJob.belongsTo(ModelVersion, {
    foreignKey: 'modelId',
    as: 'model',
  });
  
  TrainingJob.hasOne(Evaluation, {
    foreignKey: 'trainingJobId',
    as: 'evaluation',
    onDelete: 'SET NULL',
  });

  // Evaluation associations
  Evaluation.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
  });
  
  Evaluation.belongsTo(ModelVersion, {
    foreignKey: 'modelId',
    as: 'model',
  });
  
  Evaluation.belongsTo(TrainingJob, {
    foreignKey: 'trainingJobId',
    as: 'trainingJob',
  });

  // Deployment associations
  Deployment.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
  });
  
  Deployment.belongsTo(ModelVersion, {
    foreignKey: 'modelId',
    as: 'model',
  });

  // AuditLog associations
  AuditLog.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
  });
};

// Initialize associations
defineAssociations();

// Export models and sequelize instance as db object
const db = {
  sequelize,
  Sequelize,
  User,
  ModelVersion,
  TrainingJob,
  Evaluation,
  Deployment,
  AuditLog,
  Op: Sequelize.Op,
};

// Export individual models for easier imports
export {
  sequelize,
  User,
  ModelVersion,
  TrainingJob,
  Evaluation,
  Deployment,
  AuditLog,
  db, // Export the db object
};

// Export as default
export default db;

// Helper function to sync database
export const syncDatabase = async (options = {}) => {
  try {
    if (options.force) {
      logger.warn('Force syncing database - this will drop all tables!');
      await sequelize.sync({ force: true });
      logger.info('Database force synced successfully');
    } else if (options.alter) {
      await sequelize.sync({ alter: true });
      logger.info('Database altered successfully');
    } else {
      await sequelize.sync();
      logger.info('Database synced successfully');
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to sync database:', error);
    throw error;
  }
};

// Helper function to test connection
export const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

// Helper function to close connection
export const closeConnection = async () => {
  try {
    await sequelize.close();
    logger.info('Database connection closed successfully.');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
};

// Model validation helper
export const validateModel = async (modelInstance) => {
  try {
    await modelInstance.validate();
    return { valid: true, errors: [] };
  } catch (error) {
    const errors = error.errors ? error.errors.map(err => ({
      field: err.path,
      message: err.message,
      type: err.type,
    })) : [{ message: error.message }];
    
    return { valid: false, errors };
  }
};

// Model statistics
export const getModelStatistics = async () => {
  const [
    userCount,
    modelCount,
    trainingJobCount,
    evaluationCount,
    deploymentCount,
    auditLogCount,
  ] = await Promise.all([
    User.count(),
    ModelVersion.count(),
    TrainingJob.count(),
    Evaluation.count(),
    Deployment.count(),
    AuditLog.count(),
  ]);
  
  return {
    users: userCount,
    models: modelCount,
    trainingJobs: trainingJobCount,
    evaluations: evaluationCount,
    deployments: deploymentCount,
    auditLogs: auditLogCount,
  };
};

// Database health check
export const checkDatabaseHealth = async () => {
  try {
    // Test connection
    await testConnection();
    
    // Test basic queries
    await User.findOne({ limit: 1 });
    await ModelVersion.findOne({ limit: 1 });
    
    // Get table sizes
    const tableSizes = await sequelize.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
    `);
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connection: 'established',
      tableCounts: await getModelStatistics(),
      tableSizes: tableSizes[0],
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
};

// Export model constants
export const MODEL_STATUS = {
  DRAFT: 'draft',
  TRAINING: 'training',
  TRAINED: 'trained',
  FAILED: 'failed',
  ARCHIVED: 'archived',
};

export const TRAINING_STATUS = {
  PENDING: 'pending',
  PREPROCESSING: 'preprocessing',
  TRAINING: 'training',
  VALIDATING: 'validating',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export const DEPLOYMENT_STATUS = {
  PENDING: 'pending',
  DEPLOYING: 'deploying',
  ACTIVE: 'active',
  UPDATING: 'updating',
  FAILED: 'failed',
  SCALED: 'scaled',
  INACTIVE: 'inactive',
};

export const EVALUATION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer',
};

export const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  INACTIVE: 'inactive',
};