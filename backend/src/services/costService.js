import { TrainingJob, Deployment, Evaluation } from '../database/models/index.js';
import { AppError } from '../core/errors/AppError.js';
import logger from '../core/utils/logger.js';
import config from '../config/index.js';
import AWS from 'aws-sdk';

const costExplorer = new AWS.CostExplorer({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region,
});

class CostService {
  async calculateTrainingCost(trainingJob) {
    // Calculate cost based on:
    // 1. Model size and complexity
    // 2. Training duration
    // 3. Compute resources used
    // 4. OpenAI API costs if applicable

    const baseCost = 0.01; // $ per hour per compute unit
    const dataProcessingCost = 0.001; // $ per GB of data processed
    const openAICost = this.calculateOpenAICost(trainingJob);

    const durationHours = trainingJob.duration / 3600;
    const computeCost = baseCost * durationHours;
    
    const dataSizeGB = trainingJob.datasetInfo?.size || 1;
    const dataCost = dataProcessingCost * dataSizeGB;

    const totalCost = computeCost + dataCost + openAICost;

    return {
      compute: computeCost,
      data: dataCost,
      openai: openAICost,
      total: totalCost,
      currency: 'USD',
    };
  }

  calculateOpenAICost(trainingJob) {
    const { hyperparameters } = trainingJob;
    const model = hyperparameters?.baseModel || 'gpt-3.5-turbo';
    
    const prices = {
      'gpt-4': 0.03,
      'gpt-4-turbo': 0.01,
      'gpt-3.5-turbo': 0.0015,
      'gpt-3.5-turbo-instruct': 0.0015,
    };

    const pricePerToken = prices[model] || 0.001;
    const estimatedTokens = hyperparameters?.estimatedTokens || 1000000;

    return pricePerToken * estimatedTokens / 1000; // Convert to cost per thousand tokens
  }

  async calculateDeploymentCost(deployment) {
    const { scalingConfig, resourceUsage } = deployment;
    
    // AWS SageMaker pricing
    const instancePrices = {
      'ml.m5.large': 0.134,
      'ml.m5.xlarge': 0.268,
      'ml.m5.2xlarge': 0.536,
      'ml.m5.4xlarge': 1.072,
      'ml.m5.12xlarge': 3.216,
      'ml.m5.24xlarge': 6.432,
    };

    const instanceType = config.aws.sagemaker.instanceType || 'ml.m5.large';
    const hourlyRate = instancePrices[instanceType] || 0.134;
    const instances = scalingConfig?.minInstances || 1;

    const uptimeHours = deployment.getUptime() / 3600;
    const computeCost = hourlyRate * instances * uptimeHours;

    // Add data transfer costs
    const dataTransferCost = 0.09; // $ per GB
    
    const requests = deployment.traffic?.requests || 0;
    const avgRequestSize = 0.001; // 1MB per request in GB
    const dataTransfer = requests * avgRequestSize;
    const transferCost = dataTransferCost * dataTransfer;

    const totalCost = computeCost + transferCost;

    return {
      compute: computeCost,
      dataTransfer: transferCost,
      total: totalCost,
      hourlyRate,
      instances,
      uptimeHours,
      currency: 'USD',
    };
  }

  async getUserCostSummary(userId, startDate, endDate) {
    const where = {
      userId,
      createdAt: {
        [Op.between]: [startDate, endDate],
      },
    };

    const [trainingCosts, deploymentCosts, evaluationCosts] = await Promise.all([
      TrainingJob.sum('cost', { where }),
      Deployment.sum('cost', { where }),
      Evaluation.sum('cost', { where }),
    ]);

    const total = (trainingCosts || 0) + (deploymentCosts || 0) + (evaluationCosts || 0);

    return {
      period: { startDate, endDate },
      training: trainingCosts || 0,
      deployment: deploymentCosts || 0,
      evaluation: evaluationCosts || 0,
      total,
      currency: 'USD',
    };
  }

  async getCostBreakdown(userId, period = 'month') {
    const now = new Date();
    let startDate, groupBy;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 86400000); // 1 day
        groupBy = 'hour';
        break;
      case 'week':
        startDate = new Date(now.getTime() - 604800000); // 7 days
        groupBy = 'day';
        break;
      case 'month':
        startDate = new Date(now.getTime() - 2592000000); // 30 days
        groupBy = 'day';
        break;
      case 'year':
        startDate = new Date(now.getTime() - 31536000000); // 365 days
        groupBy = 'month';
        break;
      default:
        startDate = new Date(now.getTime() - 2592000000);
        groupBy = 'day';
    }

    const breakdown = {
      byService: await this.getCostByService(userId, startDate, now),
      byModel: await this.getCostByModel(userId, startDate, now),
      byEnvironment: await this.getCostByEnvironment(userId, startDate, now),
      trend: await this.getCostTrend(userId, startDate, now, groupBy),
    };

    return breakdown;
  }

  async getCostByService(userId, startDate, endDate) {
    const where = {
      userId,
      createdAt: { [Op.between]: [startDate, endDate] },
    };

    const results = await Promise.all([
      TrainingJob.sum('cost', { where }),
      Deployment.sum('cost', { where }),
      Evaluation.sum('cost', { where }),
    ]);

    return {
      training: results[0] || 0,
      deployment: results[1] || 0,
      evaluation: results[2] || 0,
    };
  }

  async getCostByModel(userId, startDate, endDate) {
    const { ModelVersion } = await import('../database/models/index.js');
    
    const models = await ModelVersion.findAll({
      where: { userId },
      attributes: ['id', 'name'],
      include: [
        {
          model: TrainingJob,
          as: 'trainingJobs',
          attributes: [],
          where: {
            createdAt: { [Op.between]: [startDate, endDate] },
          },
          required: false,
        },
        {
          model: Deployment,
          as: 'deployments',
          attributes: [],
          where: {
            createdAt: { [Op.between]: [startDate, endDate] },
          },
          required: false,
        },
      ],
    });

    return models.map(model => ({
      modelId: model.id,
      modelName: model.name,
      trainingCost: model.trainingJobs?.reduce((sum, job) => sum + (job.cost || 0), 0) || 0,
      deploymentCost: model.deployments?.reduce((sum, dep) => sum + (dep.cost || 0), 0) || 0,
      totalCost: (model.trainingJobs || []).concat(model.deployments || []).reduce((sum, item) => sum + (item.cost || 0), 0),
    })).sort((a, b) => b.totalCost - a.totalCost);
  }

  async getCostByEnvironment(userId, startDate, endDate) {
    const deployments = await Deployment.findAll({
      where: {
        userId,
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        'environment',
        [Sequelize.fn('SUM', Sequelize.col('cost')), 'totalCost'],
      ],
      group: ['environment'],
    });

    return deployments.reduce((acc, dep) => ({
      ...acc,
      [dep.environment]: parseFloat(dep.dataValues.totalCost) || 0,
    }), {});
  }

  async getCostTrend(userId, startDate, endDate, groupBy) {
    let dateFormat, interval;
    
    switch (groupBy) {
      case 'hour':
        dateFormat = 'YYYY-MM-DD HH24:00:00';
        interval = '1 hour';
        break;
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        interval = '1 day';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        interval = '1 month';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
        interval = '1 day';
    }

    const trainingTrend = await TrainingJob.findAll({
      where: {
        userId,
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        [Sequelize.fn('to_char', Sequelize.col('createdAt'), dateFormat), 'period'],
        [Sequelize.fn('SUM', Sequelize.col('cost')), 'cost'],
      ],
      group: ['period'],
      order: [[Sequelize.col('period'), 'ASC']],
    });

    const deploymentTrend = await Deployment.findAll({
      where: {
        userId,
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        [Sequelize.fn('to_char', Sequelize.col('createdAt'), dateFormat), 'period'],
        [Sequelize.fn('SUM', Sequelize.col('cost')), 'cost'],
      ],
      group: ['period'],
      order: [[Sequelize.col('period'), 'ASC']],
    });

    // Merge trends
    const trendMap = new Map();
    
    trainingTrend.forEach(item => {
      const period = item.dataValues.period;
      trendMap.set(period, {
        period,
        training: parseFloat(item.dataValues.cost) || 0,
        deployment: 0,
      });
    });

    deploymentTrend.forEach(item => {
      const period = item.dataValues.period;
      const existing = trendMap.get(period) || { period, training: 0 };
      trendMap.set(period, {
        ...existing,
        deployment: parseFloat(item.dataValues.cost) || 0,
      });
    });

    return Array.from(trendMap.values()).map(item => ({
      ...item,
      total: item.training + item.deployment,
    }));
  }

  async getAWSCost(startDate, endDate) {
    try {
      const response = await costExplorer.getCostAndUsage({
        TimePeriod: {
          Start: startDate.toISOString().split('T')[0],
          End: endDate.toISOString().split('T')[0],
        },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [
          {
            Type: 'SERVICE',
            Key: 'Service',
          },
        ],
      }).promise();

      return response.ResultsByTime?.[0]?.Groups?.map(group => ({
        service: group.Keys[0],
        cost: parseFloat(group.Metrics.UnblendedCost.Amount),
        currency: group.Metrics.UnblendedCost.Unit,
      })) || [];
    } catch (error) {
      logger.error('Error fetching AWS cost:', error);
      return [];
    }
  }

  async estimateTrainingCost(estimateData) {
    const {
      modelSize,
      trainingHours,
      dataSizeGB,
      modelType = 'custom',
      computeType = 'standard',
    } = estimateData;

    const computeRates = {
      standard: 0.01,
      highMemory: 0.015,
      highCPU: 0.012,
      gpu: 0.10,
    };

    const computeRate = computeRates[computeType] || 0.01;
    const computeCost = computeRate * trainingHours;

    const dataProcessingRate = 0.001;
    const dataCost = dataProcessingRate * dataSizeGB;

    const modelStorageRate = 0.000023; // $ per GB per hour
    const storageCost = modelStorageRate * modelSize * trainingHours;

    const totalCost = computeCost + dataCost + storageCost;

    return {
      compute: computeCost,
      data: dataCost,
      storage: storageCost,
      total: totalCost,
      currency: 'USD',
      assumptions: {
        computeType,
        computeRate: `${computeRate}/hour`,
        dataRate: `${dataProcessingRate}/GB`,
        storageRate: `${modelStorageRate}/GB/hour`,
      },
    };
  }
}

export default new CostService();