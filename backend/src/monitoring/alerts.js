import logger from '../core/utils/logger.js';
import { eventEmitter } from '../core/events/EventEmitter.js';
import { EVENT_TYPES } from '../core/events/eventTypes.js';
import { websocketServer } from '../websocket/server.js';

class AlertManager {
  constructor() {
    this.alerts = new Map();
    this.subscribers = new Set();
    this.thresholds = {
      highErrorRate: 0.1, // 10%
      highCpuUsage: 80, // 80%
      highMemoryUsage: 85, // 85%
      trainingStuckTime: 3600000, // 1 hour
      deploymentUnhealthyTime: 300000, // 5 minutes
    };
  }

  async checkSystemAlerts() {
    try {
      await this.checkErrorRates();
      await this.checkResourceUsage();
      await this.checkStuckJobs();
      await this.checkUnhealthyDeployments();
      await this.checkDatabaseHealth();
    } catch (error) {
      logger.error('Error checking system alerts:', error);
    }
  }

  async checkErrorRates() {
    // Check for high error rates in deployments
    const { Deployment } = await import('../database/models/index.js');
    
    const deployments = await Deployment.findAll({
      where: { status: 'active' },
    });

    for (const deployment of deployments) {
      const { requests = 0, errors = 0 } = deployment.traffic || {};
      
      if (requests > 100) {
        const errorRate = errors / requests;
        
        if (errorRate > this.thresholds.highErrorRate) {
          await this.triggerAlert({
            type: 'high_error_rate',
            severity: 'warning',
            title: 'High Error Rate Detected',
            message: `Deployment ${deployment.name} has error rate of ${(errorRate * 100).toFixed(1)}%`,
            entityId: deployment.id,
            entityType: 'Deployment',
            metadata: {
              deploymentId: deployment.id,
              errorRate,
              requests,
              errors,
            },
          });
        }
      }
    }
  }

  async checkResourceUsage() {
    // Check system resource usage
    const memoryUsage = process.memoryUsage();
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    if (memoryPercent > this.thresholds.highMemoryUsage) {
      await this.triggerAlert({
        type: 'high_memory_usage',
        severity: 'warning',
        title: 'High Memory Usage',
        message: `Memory usage is at ${memoryPercent.toFixed(1)}%`,
        metadata: {
          memoryPercent,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
        },
      });
    }

    // In production, you would check CPU usage via system metrics
  }

  async checkStuckJobs() {
    const { TrainingJob } = await import('../database/models/index.js');
    
    const stuckTime = new Date(Date.now() - this.thresholds.trainingStuckTime);
    
    const stuckJobs = await TrainingJob.findAll({
      where: {
        status: ['training', 'preprocessing'],
        updatedAt: { [Op.lt]: stuckTime },
      },
    });

    if (stuckJobs.length > 0) {
      await this.triggerAlert({
        type: 'stuck_training_jobs',
        severity: 'warning',
        title: 'Stuck Training Jobs',
        message: `${stuckJobs.length} training job(s) appear to be stuck`,
        metadata: {
          count: stuckJobs.length,
          jobIds: stuckJobs.map(j => j.id),
        },
      });
    }
  }

  async checkUnhealthyDeployments() {
    const { Deployment } = await import('../database/models/index.js');
    
    const unhealthyTime = new Date(Date.now() - this.thresholds.deploymentUnhealthyTime);
    
    const unhealthyDeployments = await Deployment.findAll({
      where: {
        status: 'active',
        healthStatus: ['unhealthy', 'degraded'],
        lastHealthCheck: { [Op.lt]: unhealthyTime },
      },
    });

    if (unhealthyDeployments.length > 0) {
      await this.triggerAlert({
        type: 'unhealthy_deployments',
        severity: 'error',
        title: 'Unhealthy Deployments',
        message: `${unhealthyDeployments.length} deployment(s) are unhealthy`,
        metadata: {
          count: unhealthyDeployments.length,
          deploymentIds: unhealthyDeployments.map(d => d.id),
        },
      });
    }
  }

  async checkDatabaseHealth() {
    try {
      const { sequelize } = await import('../database/index.js');
      await sequelize.authenticate();
    } catch (error) {
      await this.triggerAlert({
        type: 'database_connection_error',
        severity: 'error',
        title: 'Database Connection Error',
        message: 'Failed to connect to database',
        metadata: {
          error: error.message,
        },
      });
    }
  }

  async triggerAlert(alertData) {
    const alertId = `${alertData.type}_${Date.now()}`;
    const alert = {
      id: alertId,
      ...alertData,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    // Store alert
    this.alerts.set(alertId, alert);

    // Emit event
    eventEmitter.emit(EVENT_TYPES.SYSTEM_WARNING, alert);

    // Notify via WebSocket
    websocketServer.emitToAdmins('alert', alert);

    // Log alert
    logger[alert.severity === 'error' ? 'error' : 'warn'](`Alert: ${alert.title} - ${alert.message}`);

    return alert;
  }

  async acknowledgeAlert(alertId, userId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date().toISOString();
      
      this.alerts.set(alertId, alert);
      
      logger.info(`Alert ${alertId} acknowledged by user ${userId}`);
    }
  }

  async getActiveAlerts() {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async getAlertHistory(limit = 100) {
    return Array.from(this.alerts.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async notifySubscribers(alert) {
    for (const callback of this.subscribers) {
      try {
        await callback(alert);
      } catch (error) {
        logger.error('Error in alert subscriber callback:', error);
      }
    }
  }
}

export const alertManager = new AlertManager();
export default alertManager;