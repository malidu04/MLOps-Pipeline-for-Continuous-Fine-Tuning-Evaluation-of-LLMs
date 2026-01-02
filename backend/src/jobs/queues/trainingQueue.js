import Queue from 'bull';
import config from '../../config/index.js';
import logger from '../../core/utils/logger.js';
import trainingProcessor from '../processors/trainingProcessor.js';

const trainingQueue = new Queue('training', {
    redis: config.redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

trainingQueue.process('train', trainingProcessor.handleTraining);

trainingQueue.on('completed', (job, result) => {
  logger.info(`Training job ${job.id} completed`, { result });
});

trainingQueue.on('failed', (job, error) => {
  logger.error(`Training job ${job.id} failed`, { error: error.message });
});

trainingQueue.on('stalled', (job) => {
  logger.warn(`Training job ${job.id} stalled`);
});

trainingQueue.on('active', (job) => {
  logger.info(`Training job ${job.id} started processing`);
});

trainingQueue.on('waiting', (jobId) => {
  logger.debug(`Training job ${jobId} waiting`);
});

// Clean up old jobs
trainingQueue.on('cleaned', (jobs, type) => {
  logger.info(`Cleaned ${jobs.length} ${type} jobs from training queue`);
});

export default trainingQueue;