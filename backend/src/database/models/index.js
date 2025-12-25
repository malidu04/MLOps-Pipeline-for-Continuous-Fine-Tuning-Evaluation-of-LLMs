import { Sequelize, DataTypes } from 'sequelize';
import config from '../../config/index.js';
import logger from '../../core/utils/logger.js';

// Create Sequelize instance
const sequelize = new Sequelize(config.database);

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

// Export models and sequelize instance
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
  Sequelize,
  User,
  ModelVersion,
  TrainingJob,
  Evaluation,
  Deployment,
  AuditLog,
  db as default,
};

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

// Bulk operations helper
export const bulkCreateWithValidation = async (model, data, options = {}) => {
  const results = [];
  const errors = [];
  
  for (const item of data) {
    try {
      const instance = model.build(item);
      const validation = await validateModel(instance);
      
      if (validation.valid) {
        await instance.save(options);
        results.push(instance);
      } else {
        errors.push({
          data: item,
          errors: validation.errors,
        });
      }
    } catch (error) {
      errors.push({
        data: item,
        errors: [{ message: error.message }],
      });
    }
  }
  
  return { results, errors };
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

// Model scopes
User.addScope('active', {
  where: { status: USER_STATUS.ACTIVE },
});

User.addScope('withModels', {
  include: [{
    model: ModelVersion,
    as: 'models',
    required: false,
  }],
});

ModelVersion.addScope('trained', {
  where: { status: MODEL_STATUS.TRAINED },
});

ModelVersion.addScope('withDetails', {
  include: [
    {
      model: TrainingJob,
      as: 'trainingJobs',
      limit: 1,
      order: [['createdAt', 'DESC']],
      required: false,
    },
    {
      model: Evaluation,
      as: 'evaluations',
      limit: 1,
      order: [['createdAt', 'DESC']],
      required: false,
    },
    {
      model: Deployment,
      as: 'deployments',
      where: { status: DEPLOYMENT_STATUS.ACTIVE },
      required: false,
    },
  ],
});

TrainingJob.addScope('active', {
  where: {
    status: [TRAINING_STATUS.PENDING, TRAINING_STATUS.TRAINING, TRAINING_STATUS.PREPROCESSING],
  },
});

TrainingJob.addScope('withModel', {
  include: [{
    model: ModelVersion,
    as: 'model',
    attributes: ['id', 'name', 'version'],
  }],
});

Deployment.addScope('active', {
  where: { status: DEPLOYMENT_STATUS.ACTIVE },
});

Deployment.addScope('withModel', {
  include: [{
    model: ModelVersion,
    as: 'model',
    attributes: ['id', 'name', 'version'],
  }],
});

// Model utility functions
export const findUserWithModels = async (userId) => {
  return User.scope('withModels').findByPk(userId);
};

export const findActiveDeployments = async (userId = null) => {
  const where = userId ? { userId, status: DEPLOYMENT_STATUS.ACTIVE } : { status: DEPLOYMENT_STATUS.ACTIVE };
  return Deployment.scope('withModel').findAll({ where });
};

export const findModelWithLatestTraining = async (modelId) => {
  return ModelVersion.findByPk(modelId, {
    include: [{
      model: TrainingJob,
      as: 'trainingJobs',
      limit: 1,
      order: [['createdAt', 'DESC']],
    }],
  });
};

export const bulkUpdateModelStatus = async (modelIds, status) => {
  return ModelVersion.update(
    { status },
    {
      where: {
        id: { [Sequelize.Op.in]: modelIds },
      },
    }
  );
};

// Database transaction helper
export const withTransaction = async (callback, options = {}) => {
  const transaction = await sequelize.transaction();
  
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Database migration helper
export const runMigration = async (migrationFn) => {
  const transaction = await sequelize.transaction();
  
  try {
    logger.info('Starting migration...');
    await migrationFn(transaction);
    await transaction.commit();
    logger.info('Migration completed successfully');
    return true;
  } catch (error) {
    await transaction.rollback();
    logger.error('Migration failed:', error);
    throw error;
  }
};

// Export for database/index.js
export { sequelize };