import trainingService from '../services/trainingService.js';
import { AppError } from '../core/errors/AppError.js';
import logger from '../core/utils/logger.js';

class TrainingController {
  async createTrainingJob(req, res, next) {
    try {
      const trainingData = req.validated;
      const job = await trainingService.createTrainingJob(req.user.id, trainingData);
      
      res.status(201).json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTrainingJobs(req, res, next) {
    try {
      const filters = {
        status: req.query.status,
        modelId: req.query.modelId,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
      };

      const result = await trainingService.getTrainingJobs(req.user.id, filters);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTrainingJob(req, res, next) {
    try {
      const job = await trainingService.getTrainingJobById(req.user.id, req.params.id);
      
      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelTrainingJob(req, res, next) {
    try {
      const job = await trainingService.cancelTrainingJob(req.user.id, req.params.id);
      
      res.json({
        success: true,
        data: job,
        message: 'Training job cancelled',
      });
    } catch (error) {
      next(error);
    }
  }

  async getTrainingLogs(req, res, next) {
    try {
      const job = await trainingService.getTrainingJobById(req.user.id, req.params.id);
      
      res.json({
        success: true,
        data: {
          logs: job.logs || '',
          lastUpdated: job.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getTrainingStatistics(req, res, next) {
    try {
      const stats = await trainingService.getTrainingStatistics(req.user.id);
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTrainingProgress(req, res, next) {
    try {
      // This endpoint is typically called by the ML pipeline
      const { progress, message } = req.body;
      const job = await trainingService.updateTrainingProgress(req.params.id, progress, message);
      
      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  // Add these methods if they're missing
  async completeTrainingJob(req, res, next) {
    try {
      const { metrics } = req.body;
      const job = await trainingService.completeTrainingJob(req.params.id, metrics);
      
      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  async failTrainingJob(req, res, next) {
    try {
      const { error } = req.body;
      const job = await trainingService.failTrainingJob(req.params.id, error);
      
      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new TrainingController();