import cron from 'node-cron';
import logger from '../core/utils/logger.js';
import monitoringService from '../services/monitoringService.js';
import deploymentService from '../services/deploymentService.js';
import trainingService from '../services/trainingService.js';

class Scheduler {
  constructor() {
    this.jobs = [];
  }

  start() {
    logger.info('Starting job scheduler...');

    // Health check every 5 minutes
    this.jobs.push(cron.schedule('*/5 * * * *', this.runHealthChecks.bind(this)));

    // Cost calculation every hour
    this.jobs.push(cron.schedule('0 * * * *', this.calculateCosts.bind(this)));

    // Cleanup old jobs every day at 2 AM
    this.jobs.push(cron.schedule('0 2 * * *', this.cleanupOldJobs.bind(this)));

    // Check for stuck jobs every 15 minutes
    this.jobs.push(cron.schedule('*/15 * * * *', this.checkStuckJobs.bind(this)));

    // Log scheduler start
    this.jobs.forEach(job => job.start());
    logger.info(`Scheduler started with ${this.jobs.length} jobs`);
  }

  stop() {
    this.jobs.forEach(job => job.stop());
    logger.info('Scheduler stopped');
  }

  async runHealthChecks() {
    try {
      logger.debug('Running scheduled health checks');
      
      const health = await monitoringService.getSystemHealth();
      await monitoringService.logMetric('system_health', health);
      
      if (health.status !== 'healthy') {
        logger.warn('System health check failed:', health);
      }
    } catch (error) {
      logger.error('Health check scheduler error:', error);
    }
  }

  async calculateCosts() {
    try {
      logger.debug('Calculating costs for running jobs');
      
      // Calculate costs for active deployments
      const activeDeployments = await deploymentService.getDeployments({ status: 'active' });
      
      for (const deployment of activeDeployments.deployments) {
        const cost = await deploymentService.calculateDeploymentCost(deployment);
        await deployment.update({ cost: cost.total });
      }

      // Calculate costs for completed training jobs
      const completedTrainings = await trainingService.getTrainingJobs({
        status: 'completed',
        endTime: { [Op.gte]: new Date(Date.now() - 86400000) }, // Last 24 hours
      });

      for (const job of completedTrainings.jobs) {
        const cost = await trainingService.calculateTrainingCost(job);
        await job.update({ cost: cost.total });
      }
    } catch (error) {
      logger.error('Cost calculation scheduler error:', error);
    }
  }

  async cleanupOldJobs() {
    try {
      logger.debug('Cleaning up old jobs');
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      
      // Archive old completed jobs
      await trainingService.archiveOldJobs(thirtyDaysAgo);
      
      // Delete old logs
      await this.cleanupOldLogs();
      
      logger.info('Old jobs cleanup completed');
    } catch (error) {
      logger.error('Cleanup scheduler error:', error);
    }
  }

  async checkStuckJobs() {
    try {
      logger.debug('Checking for stuck jobs');
      
      const oneHourAgo = new Date(Date.now() - 3600000);
      
      // Check for stuck training jobs
      const stuckTrainings = await trainingService.getTrainingJobs({
        status: ['training', 'preprocessing'],
        updatedAt: { [Op.lt]: oneHourAgo },
      });

      if (stuckTrainings.total > 0) {
        logger.warn(`Found ${stuckTrainings.total} stuck training jobs`);
        
        // Attempt to restart stuck jobs
        for (const job of stuckTrainings.jobs) {
          try {
            await trainingService.cancelTrainingJob(job.userId, job.id);
            logger.info(`Cancelled stuck training job: ${job.id}`);
          } catch (error) {
            logger.error(`Failed to cancel stuck job ${job.id}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Stuck job check scheduler error:', error);
    }
  }

  async cleanupOldLogs() {
    try {
      const { AuditLog } = await import('../database/models/index.js');
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
      
      await AuditLog.destroy({
        where: {
          createdAt: { [Op.lt]: ninetyDaysAgo },
        },
      });
      
      logger.info('Old logs cleanup completed');
    } catch (error) {
      logger.error('Log cleanup error:', error);
    }
  }
}

export default new Scheduler();