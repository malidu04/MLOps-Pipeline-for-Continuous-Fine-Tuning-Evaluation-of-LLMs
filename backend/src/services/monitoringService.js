import { TrainingJob, Deployment, Evaluation } from '../database/models/index.js';
import { AppError } from '../core/errors/AppError.js';
import { eventEmitter } from '../core/events/EventEmitter.js';
import { EVENT_TYPES } from '../core/events/eventTypes.js';
import logger from '../core/utils/logger.js';
import redisClient from '../database/redisClient.js';
import axios from 'axios';
import config from '../config/index.js';

class MonitoringService {
  async getSystemHealth() {
    try {
      const checks = {
        database: await this.checkDatabase(),
        redis: await this.checkRedis(),
        mlPipeline: await this.checkMLPipeline(),
        aws: await this.checkAWS(),
      };

      const allHealthy = Object.values(checks).every(check => check.healthy);
      const status = allHealthy ? 'healthy' : 'degraded';

      return {
        status,
        timestamp: new Date().toISOString(),
        checks,
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  async checkDatabase() {
    try {
      const { sequelize } = await import('../database/index.js');
      await sequelize.authenticate();
      return { healthy: true, message: 'Database connection OK' };
    } catch (error) {
      return { healthy: false, message: `Database error: ${error.message}` };
    }
  }

  async checkRedis() {
    try {
      await redisClient.ping();
      return { healthy: true, message: 'Redis connection OK' };
    } catch (error) {
      return { healthy: false, message: `Redis error: ${error.message}` };
    }
  }

  async checkMLPipeline() {
    try {
      const response = await axios.get(`${config.environment.mlPipelineUrl}/health`, {
        timeout: 5000,
      });
      return { healthy: response.status === 200, message: 'ML Pipeline OK' };
    } catch (error) {
      return { healthy: false, message: `ML Pipeline error: ${error.message}` };
    }
  }

  async checkAWS() {
    try {
      const sts = new AWS.STS();
      await sts.getCallerIdentity().promise();
      return { healthy: true, message: 'AWS credentials OK' };
    } catch (error) {
      return { healthy: false, message: `AWS error: ${error.message}` };
    }
  }

  async getSystemMetrics() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const oneDayAgo = new Date(now.getTime() - 86400000);

    const [
      activeTrainings,
      activeDeployments,
      recentJobs,
      systemMetrics,
    ] = await Promise.all([
      TrainingJob.count({ where: { status: ['training', 'preprocessing'] } }),
      Deployment.count({ where: { status: 'active' } }),
      this.getRecentActivity(),
      this.collectSystemMetrics(),
    ]);

    return {
      timestamp: now.toISOString(),
      overview: {
        activeTrainings,
        activeDeployments,
        totalUsers: await this.getTotalUsers(),
        totalModels: await this.getTotalModels(),
      },
      performance: systemMetrics,
      recentActivity: recentJobs,
      alerts: await this.getActiveAlerts(),
    };
  }

  async getRecentActivity(limit = 10) {
    const [trainings, deployments, evaluations] = await Promise.all([
      TrainingJob.findAll({
        order: [['updatedAt', 'DESC']],
        limit,
        include: [{ model: ModelVersion, as: 'model', attributes: ['name'] }],
      }),
      Deployment.findAll({
        order: [['updatedAt', 'DESC']],
        limit: Math.ceil(limit / 2),
        include: [{ model: ModelVersion, as: 'model', attributes: ['name'] }],
      }),
      Evaluation.findAll({
        order: [['updatedAt', 'DESC']],
        limit: Math.ceil(limit / 2),
        include: [{ model: ModelVersion, as: 'model', attributes: ['name'] }],
      }),
    ]);

    return {
      trainings,
      deployments,
      evaluations,
    };
  }

  async collectSystemMetrics() {
    const memory = process.memoryUsage();
    const uptime = process.uptime();

    return {
      memory: {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        rss: memory.rss,
      },
      cpu: process.cpuUsage(),
      uptime,
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  async getActiveAlerts() {
    const alerts = [];
    const now = new Date();

    // Check for stuck jobs
    const stuckJobs = await TrainingJob.findAll({
      where: {
        status: 'training',
        updatedAt: {
          [Op.lt]: new Date(now.getTime() - 3600000), // Older than 1 hour
        },
      },
    });

    if (stuckJobs.length > 0) {
      alerts.push({
        type: 'warning',
        message: `${stuckJobs.length} training jobs appear to be stuck`,
        count: stuckJobs.length,
        timestamp: now,
      });
    }

    // Check for unhealthy deployments
    const unhealthyDeployments = await Deployment.findAll({
      where: {
        status: 'active',
        healthStatus: ['unhealthy', 'degraded'],
      },
    });

    if (unhealthyDeployments.length > 0) {
      alerts.push({
        type: 'error',
        message: `${unhealthyDeployments.length} deployments are unhealthy`,
        count: unhealthyDeployments.length,
        timestamp: now,
      });
    }

    // Check for high error rates
    const highErrorDeployments = await Deployment.findAll({
      where: {
        status: 'active',
        [Op.and]: [
          Sequelize.where(
            Sequelize.literal('("traffic"->>\'errors\')::int'),
            Op.gt,
            0
          ),
          Sequelize.where(
            Sequelize.literal('("traffic"->>\'requests\')::int'),
            Op.gt,
            100
          ),
          Sequelize.where(
            Sequelize.literal('("traffic"->>\'errors\')::float / ("traffic"->>\'requests\')::float'),
            Op.gt,
            0.1
          ),
        ],
      },
    });

    if (highErrorDeployments.length > 0) {
      alerts.push({
        type: 'warning',
        message: `${highErrorDeployments.length} deployments have high error rates (>10%)`,
        count: highErrorDeployments.length,
        timestamp: now,
      });
    }

    return alerts;
  }

  async getTotalUsers() {
    const { User } = await import('../database/models/index.js');
    return User.count();
  }

  async getTotalModels() {
    const { ModelVersion } = await import('../database/models/index.js');
    return ModelVersion.count();
  }

  async logMetric(metricName, value, tags = {}) {
    const timestamp = Date.now();
    const key = `metrics:${metricName}:${timestamp}`;
    
    await redisClient.hset(key, {
      value: JSON.stringify(value),
      timestamp,
      ...tags,
    });

    // Keep only last 1000 metrics per type
    const allKeys = await redisClient.keys(`metrics:${metricName}:*`);
    if (allKeys.length > 1000) {
      const keysToDelete = allKeys.sort().slice(0, allKeys.length - 1000);
      await redisClient.del(...keysToDelete);
    }
  }

  async getMetricHistory(metricName, startTime, endTime) {
    const keys = await redisClient.keys(`metrics:${metricName}:*`);
    const metrics = [];

    for (const key of keys) {
      const data = await redisClient.hgetall(key);
      if (data && data.timestamp) {
        const timestamp = parseInt(data.timestamp);
        if (timestamp >= startTime && timestamp <= endTime) {
          metrics.push({
            timestamp,
            value: JSON.parse(data.value),
            ...data,
          });
        }
      }
    }

    return metrics.sort((a, b) => a.timestamp - b.timestamp);
  }
}

export default new MonitoringService();