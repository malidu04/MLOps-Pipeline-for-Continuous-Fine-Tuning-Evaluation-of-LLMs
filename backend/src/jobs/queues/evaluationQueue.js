import Queue from 'bull';
import config from '../../config/index.js';
import logger from '../../core/utils/logger.js';
import evaluationProcessor from '../processors/evaluationProcessor.js';

const evaluationQueue = new Queue('evaluation', {
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

// Process jobs
evaluationQueue.process('evaluate', evaluationProcessor.handleEvaluation);

// Event handlers
evaluationQueue.on('completed', (job, result) => {
  logger.info(`Evaluation job ${job.id} completed`, { result });
});

evaluationQueue.on('failed', (job, error) => {
  logger.error(`Evaluation job ${job.id} failed`, { error: error.message });
});

evaluationQueue.on('stalled', (job) => {
  logger.warn(`Evaluation job ${job.id} stalled`);
});

export default evaluationQueue;