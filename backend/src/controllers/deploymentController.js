import deploymentService from '../services/deploymentService.js';
import { AppError } from '../core/errors/AppError.js';
import logger from '../core/utils/logger.js';

class DeploymentController {
  async createDeployment(req, res, next) {
    try {
      const deploymentData = req.validated;
      const deployment = await deploymentService.createDeployment(req.user.id, deploymentData);
      
      res.status(201).json({
        success: true,
        data: deployment,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDeployments(req, res, next) {
    try {
      const filters = {
        environment: req.query.environment,
        status: req.query.status,
        modelId: req.query.modelId,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
      };

      const result = await deploymentService.getDeployments(req.user.id, filters);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDeployment(req, res, next) {
    try {
      const deployment = await deploymentService.getDeploymentById(req.user.id, req.params.id);
      
      res.json({
        success: true,
        data: deployment,
      });
    } catch (error) {
      next(error);
    }
  }

  async scaleDeployment(req, res, next) {
    try {
      const { minInstances, maxInstances } = req.body;
      
      const deployment = await deploymentService.scaleDeployment(
        req.user.id,
        req.params.id,
        { minInstances, maxInstances }
      );
      
      res.json({
        success: true,
        data: deployment,
        message: 'Deployment scaled successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteDeployment(req, res, next) {
    try {
      await deploymentService.deleteDeployment(req.user.id, req.params.id);
      
      res.json({
        success: true,
        message: 'Deployment deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getDeploymentMetrics(req, res, next) {
    try {
      const metrics = await deploymentService.getDeploymentMetrics(req.user.id, req.params.id);
      
      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDeploymentStatistics(req, res, next) {
    try {
      const stats = await deploymentService.getDeploymentStatistics(req.user.id);
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async makePrediction(req, res, next) {
    try {
      const deployment = await deploymentService.getDeploymentById(req.user.id, req.params.id);
      
      if (deployment.status !== 'active' || !deployment.endpoint) {
        throw new AppError('Deployment is not active or endpoint not available', 400);
      }

      // Forward prediction request to the deployed model endpoint
      const predictionResponse = await axios.post(deployment.endpoint, {
        apiKey: deployment.apiKey,
        data: req.body.data,
      });

      // Update traffic metrics
      await deployment.updateTraffic(1, 0, predictionResponse.headers['x-response-time'] || 0);

      res.json({
        success: true,
        data: predictionResponse.data,
      });
    } catch (error) {
      // Update error count
      const deployment = await deploymentService.getDeploymentById(req.user.id, req.params.id);
      await deployment.updateTraffic(1, 1, 0);
      
      next(error);
    }
  }

  async updateDeploymentStatus(req, res, next) {
    try {
      // This endpoint is typically called by the ML pipeline or monitoring system
      const { status, endpoint, apiKey, metrics, healthStatus } = req.body;
      
      const deployment = await deploymentService.updateDeployment(req.params.id, {
        status,
        endpoint,
        apiKey,
        metrics,
        healthStatus,
      });
      
      res.json({
        success: true,
        data: deployment,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new DeploymentController();