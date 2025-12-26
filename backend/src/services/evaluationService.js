import { Evaluation, ModelVersion, TrainingJob } from '../database/models/index.js';
import { AppError } from '../core/errors/AppError.js';
import { eventEmitter } from '../core/events/EventEmitter.js';
import { EVENT_TYPES } from '../core/events/eventTypes.js';
import logger from '../core/utils/logger.js';
import { evaluationQueue } from '../jobs/queues/evaluationQueue.js';
import config from '../config/index.js';
import axios from 'axios';


class EvaluationService {
  async createEvaluation(userId, evaluationData) {
    try {
      const model = await ModelVersion.findOne({
        where: { id: evaluationData.modelId, userId },
      });

      if (!model) {
        throw new AppError('Model not found', 404);
      }

      const evaluation = await Evaluation.create({
        ...evaluationData,
        userId,
        name: `${model.name} - Evaluation ${new Date().toISOString().split('T')[0]}`,
      });

      // Add to queue
      await evaluationQueue.add({
        evaluationId: evaluation.id,
        userId,
        modelId: model.id,
        evaluationData,
      });

      eventEmitter.emit(EVENT_TYPES.EVALUATION_STARTED, evaluation);

      return evaluation;
    } catch (error) {
      logger.error('Error creating evaluation:', error);
      throw error;
    }
  }

  async getEvaluations(userId, filters = {}) {
    const where = { userId };
    const { modelId, status, limit = 20, offset = 0 } = filters;

    if (modelId) where.modelId = modelId;
    if (status) where.status = status;

    const { count, rows } = await Evaluation.findAndCountAll({
      where,
      include: [
        {
          model: ModelVersion,
          as: 'model',
          attributes: ['id', 'name', 'version'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      total: count,
      evaluations: rows,
    };
  }

  async getEvaluationById(userId, evaluationId) {
    const evaluation = await Evaluation.findOne({
      where: { id: evaluationId, userId },
      include: [
        {
          model: ModelVersion,
          as: 'model',
        },
        {
          model: TrainingJob,
          as: 'trainingJob',
          required: false,
        },
      ],
    });

    if (!evaluation) {
      throw new AppError('Evaluation not found', 404);
    }

    return evaluation;
  }

  async updateEvaluation(evaluationId, updateData) {
    const evaluation = await Evaluation.findByPk(evaluationId);
    if (!evaluation) {
      throw new AppError('Evaluation not found', 404);
    }

    const allowedUpdates = ['status', 'metrics', 'confusionMatrix', 'classificationReport', 'driftMetrics', 'notes', 'cost'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return evaluation;
    }

    const previousStatus = evaluation.status;
    await evaluation.update(updates);

    // Emit completion event if status changed to completed
    if (previousStatus !== 'completed' && evaluation.status === 'completed') {
      eventEmitter.emit(EVENT_TYPES.EVALUATION_COMPLETED, evaluation);
    }

    return evaluation;
  }

  async runDriftDetection(userId, modelId, baselineData, currentData) {
    try {
      const response = await axios.post(`${config.environment.mlPipelineUrl}/api/evaluation/drift`, {
        modelId,
        baselineData,
        currentData,
      });

      return response.data;
    } catch (error) {
      logger.error('Error running drift detection:', error);
      throw new AppError('Failed to run drift detection', 500);
    }
  }

  async compareEvaluations(userId, evaluationIds) {
    if (evaluationIds.length < 2) {
      throw new AppError('At least two evaluations are required for comparison', 400);
    }

    const evaluations = await Evaluation.findAll({
      where: {
        id: evaluationIds,
        userId,
      },
      include: [
        {
          model: ModelVersion,
          as: 'model',
          attributes: ['name', 'version'],
        },
      ],
    });

    if (evaluations.length !== evaluationIds.length) {
      throw new AppError('Some evaluations not found or access denied', 404);
    }

    const comparison = evaluations.map(eval => ({
      id: eval.id,
      modelName: eval.model.name,
      modelVersion: eval.model.version,
      metrics: eval.metrics,
      overallScore: eval.getOverallScore(),
      createdAt: eval.createdAt,
    }));

    // Sort by overall score
    comparison.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

    return {
      evaluations: comparison,
      bestModel: comparison[0],
      metricsSummary: this.calculateMetricsSummary(comparison),
    };
  }

  calculateMetricsSummary(evaluations) {
    const allMetrics = new Set();
    evaluations.forEach(eval => {
      Object.keys(eval.metrics || {}).forEach(metric => allMetrics.add(metric));
    });

    const summary = {};
    allMetrics.forEach(metric => {
      const values = evaluations
        .map(e => e.metrics?.[metric])
        .filter(v => typeof v === 'number');
      
      if (values.length > 0) {
        summary[metric] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
        };
      }
    });

    return summary;
  }

  async getEvaluationStatistics(userId) {
    const stats = await Evaluation.findAll({
      where: { userId },
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('AVG', Sequelize.col('executionTime')), 'avgTime'],
        [Sequelize.fn('SUM', Sequelize.col('cost')), 'totalCost'],
      ],
      group: ['status'],
    });

    const recentEvaluations = await Evaluation.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [
        {
          model: ModelVersion,
          as: 'model',
          attributes: ['name'],
        },
      ],
    });

    return {
      byStatus: stats.reduce((acc, stat) => ({
        ...acc,
        [stat.status]: {
          count: parseInt(stat.dataValues.count),
          avgTime: parseFloat(stat.dataValues.avgTime) || 0,
        },
      }), {}),
      totalCost: stats.reduce((sum, stat) => sum + parseFloat(stat.dataValues.totalCost || 0), 0),
      recentEvaluations,
    };
  }
}

export default new EvaluationService();