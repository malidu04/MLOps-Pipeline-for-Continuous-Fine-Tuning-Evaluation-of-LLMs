import { TrainingJob, ModelVersion } from '../database/models/index.js';
import { AppError } from '../core/errors/AppError.js';
import { eventEmitter } from '../core/events/EventEmitter.js';
import { EVENT_TYPES } from '../core/events/eventTypes.js';
import logger from '../core/utils/logger.js';
import trainingQueue from '../jobs/queues/trainingQueue.js';
import config from '../config/index.js';
import axios from 'axios';

class TrainingService {
  async createTrainingJob(userId, trainingData) {
    try {
      const model = await ModelVersion.findOne({
        where: { id: trainingData.modelId, userId },
      });

      if (!model) {
        throw new AppError('Model not found', 404);
      }

      const trainingJob = await TrainingJob.create({
        ...trainingData,
        userId,
        name: `${model.name} - Training ${new Date().toISOString().split('T')[0]}`,
        startTime: new Date(),
      });

      // Add to queue
      await trainingQueue.add({
        jobId: trainingJob.id,
        userId,
        modelId: model.id,
        trainingData,
      }, {
        jobId: trainingJob.id,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });

      // Update model status
      await model.update({ status: 'training' });

      eventEmitter.emit(EVENT_TYPES.TRAINING_STARTED, trainingJob);

      return trainingJob;
    } catch (error) {
      logger.error('Error creating training job:', error);
      throw error;
    }
  }

  async getTrainingJobs(userId, filters = {}) {
    const where = { userId };
    const { status, modelId, limit = 20, offset = 0 } = filters;

    if (status) where.status = status;
    if (modelId) where.modelId = modelId;

    const { count, rows } = await TrainingJob.findAndCountAll({
      where,
      include: [
        {
          model: ModelVersion,
          as: 'model',
          attributes: ['id', 'name', 'version'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      total: count,
      jobs: rows,
    };
  }

  async getTrainingJobById(userId, jobId) {
    const job = await TrainingJob.findOne({
      where: { id: jobId, userId },
      include: [
        {
          model: ModelVersion,
          as: 'model',
        },
      ],
    });

    if (!job) {
      throw new AppError('Training job not found', 404);
    }

    return job;
  }

  async updateTrainingProgress(jobId, progress, message = null) {
    const job = await TrainingJob.findByPk(jobId);
    if (!job) {
      throw new AppError('Training job not found', 404);
    }

    await job.updateProgress(progress, message);

    eventEmitter.emit(EVENT_TYPES.TRAINING_PROGRESS, {
      jobId,
      userId: job.userId,
      progress,
      status: job.status,
      message,
    });

    return job;
  }

  async completeTrainingJob(jobId, metrics) {
    const job = await TrainingJob.findByPk(jobId);
    if (!job) {
      throw new AppError('Training job not found', 404);
    }

    await job.complete(metrics);

    // Update model status
    const model = await ModelVersion.findByPk(job.modelId);
    if (model) {
      await model.update({ status: 'trained' });
    }

    eventEmitter.emit(EVENT_TYPES.TRAINING_COMPLETED, job);

    return job;
  }

  async failTrainingJob(jobId, error) {
    const job = await TrainingJob.findByPk(jobId);
    if (!job) {
      throw new AppError('Training job not found', 404);
    }

    await job.fail(error);

    // Update model status
    const model = await ModelVersion.findByPk(job.modelId);
    if (model) {
      await model.update({ status: 'failed' });
    }

    eventEmitter.emit(EVENT_TYPES.TRAINING_FAILED, { job, error });

    return job;
  }

  async cancelTrainingJob(userId, jobId) {
    const job = await this.getTrainingJobById(userId, jobId);
    
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      throw new AppError('Cannot cancel a completed, failed, or cancelled job', 400);
    }

    // Try to cancel in ML pipeline
    if (job.externalJobId) {
      try {
        await axios.post(`${config.environment.mlPipelineUrl}/api/training/cancel`, {
          jobId: job.externalJobId,
        });
      } catch (error) {
        logger.error('Failed to cancel job in ML pipeline:', error);
      }
    }

    await job.update({
      status: 'cancelled',
      endTime: new Date(),
    });

    return job;
  }

  async getTrainingStatistics(userId) {
    const stats = await TrainingJob.findAll({
      where: { userId },
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('AVG', Sequelize.col('duration')), 'avgDuration'],
        [Sequelize.fn('SUM', Sequelize.col('cost')), 'totalCost'],
      ],
      group: ['status'],
    });

    const recentJobs = await TrainingJob.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [
        {
          model: ModelVersion,
          as: 'model',
          attributes: ['name'],
        },
      ],
    });

    return {
      byStatus: stats.reduce((acc, stat) => ({
        ...acc,
        [stat.status]: {
          count: parseInt(stat.dataValues.count),
          avgDuration: parseFloat(stat.dataValues.avgDuration) || 0,
        },
      }), {}),
      totalCost: stats.reduce((sum, stat) => sum + parseFloat(stat.dataValues.totalCost || 0), 0),
      recentJobs,
    };
  }
  async updateTrainingProgress(jobId, progress, message = null) {
  const job = await TrainingJob.findByPk(jobId);
  if (!job) {
    throw new AppError('Training job not found', 404);
  }

  await job.updateProgress(progress, message);

  eventEmitter.emit(EVENT_TYPES.TRAINING_PROGRESS, {
    jobId,
    userId: job.userId,
    progress,
    status: job.status,
    message,
  });

  return job;
}

async completeTrainingJob(jobId, metrics) {
  const job = await TrainingJob.findByPk(jobId);
  if (!job) {
    throw new AppError('Training job not found', 404);
  }

  await job.complete(metrics);

  // Update model status
  const model = await ModelVersion.findByPk(job.modelId);
  if (model) {
    await model.update({ status: 'trained' });
  }

  eventEmitter.emit(EVENT_TYPES.TRAINING_COMPLETED, job);

  return job;
}

async failTrainingJob(jobId, error) {
  const job = await TrainingJob.findByPk(jobId);
  if (!job) {
    throw new AppError('Training job not found', 404);
  }

  await job.fail(error);

  // Update model status
  const model = await ModelVersion.findByPk(job.modelId);
  if (model) {
    await model.update({ status: 'failed' });
  }

  eventEmitter.emit(EVENT_TYPES.TRAINING_FAILED, { job, error });

  return job;
}
}


export default new TrainingService();