import Queue from 'bull';
import config from '../../config/index.js';
import logger from '../../core/utils/logger.js';
import deploymentProcessor from '../processors/deploymentProcessor.js';

const deploymentQueue = new Queue('deployment', {
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
deploymentQueue.process('deploy', deploymentProcessor.handleDeployment);

// Event handlers
deploymentQueue.on('completed', (job, result) => {
  logger.info(`Deployment job ${job.id} completed`, { result });
});

deploymentQueue.on('failed', (job, error) => {
  logger.error(`Deployment job ${job.id} failed`, { error: error.message });
});

deploymentQueue.on('stalled', (job) => {
  logger.warn(`Deployment job ${job.id} stalled`);
});

export default deploymentQueue;