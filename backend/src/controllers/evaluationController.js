import evaluationService from '../services/evaluationService.js';
import { AppError } from '../core/errors/AppError.js';
import logger from '../core/utils/logger.js';

class EvaluationController {
  async createEvaluation(req, res, next) {
    try {
      const evaluationData = req.validated;
      const evaluation = await evaluationService.createEvaluation(req.user.id, evaluationData);
      
      res.status(201).json({
        success: true,
        data: evaluation,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEvaluations(req, res, next) {
    try {
      const filters = {
        modelId: req.query.modelId,
        status: req.query.status,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
      };

      const result = await evaluationService.getEvaluations(req.user.id, filters);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEvaluation(req, res, next) {
    try {
      const evaluation = await evaluationService.getEvaluationById(req.user.id, req.params.id);
      
      res.json({
        success: true,
        data: evaluation,
      });
    } catch (error) {
      next(error);
    }
  }

  async runDriftDetection(req, res, next) {
    try {
      const { modelId, baselineData, currentData } = req.body;
      
      const result = await evaluationService.runDriftDetection(
        req.user.id,
        modelId,
        baselineData,
        currentData
      );
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async compareEvaluations(req, res, next) {
    try {
      const { evaluationIds } = req.body;
      
      if (!Array.isArray(evaluationIds)) {
        throw new AppError('evaluationIds must be an array', 400);
      }

      const result = await evaluationService.compareEvaluations(req.user.id, evaluationIds);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEvaluationStatistics(req, res, next) {
    try {
      const stats = await evaluationService.getEvaluationStatistics(req.user.id);
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateEvaluationResults(req, res, next) {
    try {
      // This endpoint is typically called by the ML pipeline
      const { metrics, confusionMatrix, classificationReport, driftMetrics } = req.body;
      
      const evaluation = await evaluationService.updateEvaluation(req.params.id, {
        status: 'completed',
        metrics,
        confusionMatrix,
        classificationReport,
        driftMetrics,
      });
      
      res.json({
        success: true,
        data: evaluation,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new EvaluationController();