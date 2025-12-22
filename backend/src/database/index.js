import { Sequelize } from 'sequelize';
import config from '../config/index.js';
import logger from '../core/utils/logger.js';

import User from './models/User.js';
import ModelVersion from './models/ModelVersion.js';
import TrainingJob from './models/TrainingJob.js';
import Evaluation from './models/Evaluation.js';
import Deployment from './models/Deployment.js';
import AuditLog from './models/AuditLog.js';

const sequelize = new Sequelize(config.database);

const db = {
    sequelize,
    Sequelize,
    User,
    ModelVersion,
    TrainingJob,
    Evaluation,
    Deployment,
    AuditLog,
};

Object.values(db).forEach((model) => {
    if(model.init) {
        model.init(sequelize);
    }
});

Object.values(db).forEach((model) => {
    if(model.associate) {
        model.associate(db);
    }
});

export const testConnection = async () => {
    try {
        await sequelize.authenticate();
        logger.info('Database connection estabalished successfully.');

        if(config.environment.isDevelopment) {
            await sequelize.sync({ alert: true }),
            logger.info('Database synced.');
        }
    } catch (error) {
        logger.error('Unable to connect to the database:', error);
        process.exit(1);
    }
};

export default db;
