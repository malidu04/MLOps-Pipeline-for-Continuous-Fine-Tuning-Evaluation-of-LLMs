import modelService from '../services/modelService.js';
import trainingService from '../services/trainingService.js';
import evaluationService from '../services/evaluationService.js';
import deploymentService from '../services/deploymentService.js';
import monitoringService from '../services/monitoringService.js';
import costService from '../services/costService.js';
import { AppError } from '../core/errors/AppError.js';

class DashboardController {
  async getOverview(req, res, next) {
    try {
      const userId = req.user.id;
      
      const [
        modelStats,
        trainingStats,
        deploymentStats,
        recentActivity,
        systemHealth,
      ] = await Promise.all([
        modelService.getModelStatistics(userId),
        trainingService.getTrainingStatistics(userId),
        deploymentService.getDeploymentStatistics(userId),
        monitoringService.getRecentActivity(),
        monitoringService.getSystemHealth(),
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            models: modelStats.total,
            activeTrainings: trainingStats.byStatus?.training?.count || 0,
            activeDeployments: deploymentStats.activeDeployments,
            totalCost: trainingStats.totalCost + deploymentStats.totalCost,
          },
          modelStats,
          trainingStats,
          deploymentStats,
          recentActivity,
          systemHealth,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getCostAnalysis(req, res, next) {
    try {
      const { period = 'month' } = req.query;
      const userId = req.user.id;

      const [costBreakdown, costSummary] = await Promise.all([
        costService.getCostBreakdown(userId, period),
        costService.getUserCostSummary(
          userId,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          new Date()
        ),
      ]);

      res.json({
        success: true,
        data: {
          breakdown: costBreakdown,
          summary: costSummary,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getPerformanceMetrics(req, res, next) {
    try {
      const { timeframe = '24h' } = req.query;
      const userId = req.user.id;

      const now = new Date();
      let startTime;

      switch (timeframe) {
        case '1h':
          startTime = now.getTime() - 3600000;
          break;
        case '24h':
          startTime = now.getTime() - 86400000;
          break;
        case '7d':
          startTime = now.getTime() - 604800000;
          break;
        case '30d':
          startTime = now.getTime() - 2592000000;
          break;
        default:
          startTime = now.getTime() - 86400000;
      }

      const [trainingMetrics, deploymentMetrics, systemMetrics] = await Promise.all([
        monitoringService.getMetricHistory('training', startTime, now.getTime()),
        monitoringService.getMetricHistory('deployment', startTime, now.getTime()),
        monitoringService.getSystemMetrics(),
      ]);

      res.json({
        success: true,
        data: {
          training: trainingMetrics,
          deployment: deploymentMetrics,
          system: systemMetrics,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAlerts(req, res, next) {
    try {
      const alerts = await monitoringService.getActiveAlerts();
      
      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      next(error);
    }
  }

  async getResourceUsage(req, res, next) {
    try {
      const userId = req.user.id;

      const [trainingJobs, deployments] = await Promise.all([
        trainingService.getTrainingJobs(userId, { limit: 10 }),
        deploymentService.getDeployments(userId, { limit: 10 }),
      ]);

      const resourceUsage = {
        training: trainingJobs.jobs.map(job => ({
          id: job.id,
          name: job.name,
          cpu: job.resourceUsage?.cpu || 0,
          memory: job.resourceUsage?.memory || 0,
          gpu: job.resourceUsage?.gpu || 0,
          status: job.status,
        })),
        deployment: deployments.deployments.map(deployment => ({
          id: deployment.id,
          name: deployment.name,
          instances: deployment.scalingConfig?.minInstances || 1,
          cpu: deployment.resourceUsage?.cpu || 0,
          memory: deployment.resourceUsage?.memory || 0,
          status: deployment.status,
        })),
      };

      res.json({
        success: true,
        data: resourceUsage,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecentActivity(req, res, next) {
    try {
      const activity = await monitoringService.getRecentActivity(20);
      
      res.json({
        success: true,
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  }

  async estimateCost(req, res, next) {
    try {
      const { type, parameters } = req.body;
      
      let estimate;
      switch (type) {
        case 'training':
          estimate = await costService.estimateTrainingCost(parameters);
          break;
        case 'deployment':
          estimate = await costService.calculateDeploymentCost(parameters);
          break;
        default:
          throw new AppError('Invalid estimate type', 400);
      }

      res.json({
        success: true,
        data: estimate,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new DashboardController();