import { ModelVersion, TrainingJob, Evaluation, Deployment } from '../database/models/index.js';
import { AppError } from '../core/errors/AppError.js';
import { eventEmitter } from '../core/events/EventEmitter.js';
import { EVENT_TYPES } from '../core/events/eventTypes.js';
import logger from '../core/utils/logger.js';
import { calculateFileHash } from '../core/utils/fileHandler.js';
import config from '../config/index.js';
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region,
});

class ModelService {
  async createModel(userId, modelData) {
    try {
      const model = await ModelVersion.create({
        ...modelData,
        userId,
      });

      eventEmitter.emit(EVENT_TYPES.MODEL_CREATED, model);

      return model;
    } catch (error) {
      logger.error('Error creating model:', error);
      throw error;
    }
  }

  async getModels(userId, filters = {}) {
    const where = { userId };
    const { status, taskType, tags, search } = filters;

    if (status) where.status = status;
    if (taskType) where.taskType = taskType;
    if (tags && tags.length > 0) where.tags = { [Op.overlap]: tags };

    const options = {
      where,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: TrainingJob,
          as: 'trainingJobs',
          limit: 1,
          order: [['createdAt', 'DESC']],
        },
        {
          model: Evaluation,
          as: 'evaluations',
          limit: 1,
          order: [['createdAt', 'DESC']],
        },
      ],
    };

    if (search) {
      options.where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    return ModelVersion.findAll(options);
  }

  async getModelById(userId, modelId) {
    const model = await ModelVersion.findOne({
      where: { id: modelId, userId },
      include: [
        { model: TrainingJob, as: 'trainingJobs' },
        { model: Evaluation, as: 'evaluations' },
        { model: Deployment, as: 'deployments' },
      ],
    });

    if (!model) {
      throw new AppError('Model not found', 404);
    }

    return model;
  }

  async updateModel(userId, modelId, updateData) {
    const model = await this.getModelById(userId, modelId);
    
    const allowedUpdates = ['name', 'description', 'parameters', 'metadata', 'tags'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return model;
    }

    await model.update(updates);
    eventEmitter.emit(EVENT_TYPES.MODEL_UPDATED, model);

    return model;
  }

  async deleteModel(userId, modelId) {
    const model = await this.getModelById(userId, modelId);
    
    // Check if model has active deployments
    const activeDeployment = await model.getActiveDeployment();
    if (activeDeployment) {
      throw new AppError('Cannot delete model with active deployment', 400);
    }

    // Delete from S3 if exists
    if (model.storagePath) {
      await this.deleteModelFile(model.storagePath);
    }

    await model.destroy();
    eventEmitter.emit(EVENT_TYPES.MODEL_DELETED, model);

    return true;
  }

  async uploadModelFile(userId, modelId, file) {
    const model = await this.getModelById(userId, modelId);
    
    const key = `${config.aws.s3.modelPrefix}${userId}/${modelId}/${file.originalname}`;
    
    const uploadParams = {
      Bucket: config.aws.s3.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const uploadResult = await s3.upload(uploadParams).promise();
    
    const fileHash = await calculateFileHash(file.buffer);
    
    await model.update({
      storagePath: uploadResult.Location,
      fileHash,
      size: file.size,
      status: 'trained',
    });

    return {
      location: uploadResult.Location,
      hash: fileHash,
      size: file.size,
    };
  }

  async deleteModelFile(storagePath) {
    const key = storagePath.split('/').slice(3).join('/');
    
    await s3.deleteObject({
      Bucket: config.aws.s3.bucket,
      Key: key,
    }).promise();
  }

  async getModelStatistics(userId) {
    const stats = await ModelVersion.findAll({
      where: { userId },
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('SUM', Sequelize.col('size')), 'totalSize'],
      ],
      group: ['status'],
    });

    const total = await ModelVersion.count({ where: { userId } });
    const byTaskType = await ModelVersion.findAll({
      where: { userId },
      attributes: [
        'taskType',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      ],
      group: ['taskType'],
    });

    return {
      total,
      byStatus: stats.reduce((acc, stat) => ({
        ...acc,
        [stat.status]: parseInt(stat.dataValues.count),
      }), {}),
      byTaskType: byTaskType.reduce((acc, type) => ({
        ...acc,
        [type.taskType]: parseInt(type.dataValues.count),
      }), {}),
    };
  }
}

export default new ModelService();