import { Sequelize } from 'sequelize';
import User from './User.js';
import ModelVersion from './ModelVersion.js';
import TrainingJob from './TrainingJob.js';
import Evaluation from './Evaluation.js';
import Deployment from './Deployment.js';
import AuditLog from './AuditLog.js';

// Import your database configuration
import config from '../config/database.js';

const sequelize = new Sequelize(config);

// Initialize all models
const models = {
  User: User.init(sequelize),
  ModelVersion: ModelVersion.init(sequelize),
  TrainingJob: TrainingJob.init(sequelize),
  Evaluation: Evaluation.init(sequelize),
  Deployment: Deployment.init(sequelize),
  AuditLog: AuditLog.init(sequelize),
};

// Set up associations
Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Test the database connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
}

// Sync database (use carefully in production)
async function syncDatabase(options = {}) {
  const { force = false, alter = false } = options;
  
  try {
    if (force) {
      await sequelize.sync({ force: true });
      console.log('Database synced with force option');
    } else if (alter) {
      await sequelize.sync({ alter: true });
      console.log('Database synced with alter option');
    } else {
      await sequelize.sync();
      console.log('Database synced without modifications');
    }
  } catch (error) {
    console.error('Error syncing database:', error);
    throw error;
  }
}

export {
  sequelize,
  Sequelize,
  testConnection,
  syncDatabase,
  models,
};

export default models;