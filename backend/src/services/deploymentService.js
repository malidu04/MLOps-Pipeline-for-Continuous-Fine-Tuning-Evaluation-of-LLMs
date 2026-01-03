import { Deployment, ModelVersion } from '../database/models/index.js';
import { AppError } from '../core/errors/AppError.js';
import { eventEmitter } from '../core/events/EventEmitter.js';
import { EVENT_TYPES } from '../core/events/eventTypes.js';
import logger from '../core/utils/logger.js';
import  deploymentQueue from '../jobs/queues/deploymentQueue.js';
import config from '../config/index.js';
import axios from 'axios';
import AWS from 'aws-sdk';

const sagemaker = new AWS.SageMaker({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region,
});

class DeploymentService {
  async createDeployment(userId, deploymentData) {
    try {
      const model = await ModelVersion.findOne({
        where: { id: deploymentData.modelId, userId },
      });

      if (!model) {
        throw new AppError('Model not found', 404);
      }

      if (model.status !== 'trained') {
        throw new AppError('Model must be trained before deployment', 400);
      }

      // Check for existing active deployment
      const existingDeployment = await model.getActiveDeployment();
      if (existingDeployment && deploymentData.environment === 'production') {
        throw new AppError('Model already has an active production deployment', 400);
      }

      const deployment = await Deployment.create({
        ...deploymentData,
        userId,
        name: `${model.name} - ${deploymentData.environment}`,
        status: 'pending',
      });

      // Add to queue
      await deploymentQueue.add({
        deploymentId: deployment.id,
        userId,
        modelId: model.id,
        deploymentData,
      });

      eventEmitter.emit(EVENT_TYPES.DEPLOYMENT_STARTED, deployment);

      return deployment;
    } catch (error) {
      logger.error('Error creating deployment:', error);
      throw error;
    }
  }

  async getDeployments(userId, filters = {}) {
    const where = { userId };
    const { environment, status, modelId, limit = 20, offset = 0 } = filters;

    if (environment) where.environment = environment;
    if (status) where.status = status;
    if (modelId) where.modelId = modelId;

    const { count, rows } = await Deployment.findAndCountAll({
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
      deployments: rows,
    };
  }

  async getDeploymentById(userId, deploymentId) {
    const deployment = await Deployment.findOne({
      where: { id: deploymentId, userId },
      include: [
        {
          model: ModelVersion,
          as: 'model',
        },
      ],
    });

    if (!deployment) {
      throw new AppError('Deployment not found', 404);
    }

    return deployment;
  }

  async updateDeployment(deploymentId, updateData) {
    const deployment = await Deployment.findByPk(deploymentId);
    if (!deployment) {
      throw new AppError('Deployment not found', 404);
    }

    const allowedUpdates = [
      'status', 'endpoint', 'apiKey', 'metrics', 'resourceUsage',
      'traffic', 'healthStatus', 'cost', 'externalDeploymentId',
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    if (updateData.status === 'active' && !deployment.deployedAt) {
      updates.deployedAt = new Date();
    }

    const previousStatus = deployment.status;
    await deployment.update(updates);

    // Emit completion event if status changed to active
    if (previousStatus !== 'active' && deployment.status === 'active') {
      eventEmitter.emit(EVENT_TYPES.DEPLOYMENT_COMPLETED, deployment);
    } else if (previousStatus !== 'failed' && deployment.status === 'failed') {
      eventEmitter.emit(EVENT_TYPES.DEPLOYMENT_FAILED, deployment);
    }

    return deployment;
  }

  async deployToSageMaker(deployment, model) {
    try {
      const modelName = `model-${model.id.replace(/-/g, '')}`;
      const endpointName = `endpoint-${deployment.id.replace(/-/g, '')}`;

      // Create model in SageMaker
      await sagemaker.createModel({
        ModelName: modelName,
        PrimaryContainer: {
          Image: config.aws.sagemaker.image || 'your-model-image',
          ModelDataUrl: model.storagePath,
        },
        ExecutionRoleArn: config.aws.sagemaker.roleArn,
      }).promise();

      // Create endpoint configuration
      await sagemaker.createEndpointConfig({
        EndpointConfigName: `${endpointName}-config`,
        ProductionVariants: [
          {
            VariantName: 'AllTraffic',
            ModelName: modelName,
            InitialInstanceCount: deployment.scalingConfig.minInstances,
            InstanceType: config.aws.sagemaker.instanceType,
            InitialVariantWeight: 1,
          },
        ],
      }).promise();

      // Create endpoint
      await sagemaker.createEndpoint({
        EndpointName: endpointName,
        EndpointConfigName: `${endpointName}-config`,
      }).promise();

      const endpoint = `${endpointName}.sagemaker.${config.aws.region}.amazonaws.com`;

      await deployment.update({
        externalDeploymentId: endpointName,
        endpoint,
        status: 'deploying',
      });

      return endpoint;
    } catch (error) {
      logger.error('Error deploying to SageMaker:', error);
      throw error;
    }
  }

  async scaleDeployment(userId, deploymentId, scalingConfig) {
    const deployment = await this.getDeploymentById(userId, deploymentId);
    
    if (deployment.status !== 'active') {
      throw new AppError('Only active deployments can be scaled', 400);
    }

    if (!deployment.externalDeploymentId) {
      throw new AppError('Deployment has no external ID', 400);
    }

    try {
      await sagemaker.updateEndpointWeightsAndCapacities({
        EndpointName: deployment.externalDeploymentId,
        DesiredWeightsAndCapacities: [
          {
            VariantName: 'AllTraffic',
            DesiredWeight: 1,
            DesiredInstanceCount: scalingConfig.minInstances,
          },
        ],
      }).promise();

      await deployment.scale(scalingConfig);

      return deployment;
    } catch (error) {
      logger.error('Error scaling deployment:', error);
      throw new AppError('Failed to scale deployment', 500);
    }
  }

  async deleteDeployment(userId, deploymentId) {
    const deployment = await this.getDeploymentById(userId, deploymentId);
    
    if (deployment.status === 'active') {
      throw new AppError('Cannot delete active deployment. Scale to 0 instances first.', 400);
    }

    // Delete from SageMaker if exists
    if (deployment.externalDeploymentId) {
      try {
        await sagemaker.deleteEndpoint({
          EndpointName: deployment.externalDeploymentId,
        }).promise();

        await sagemaker.deleteEndpointConfig({
          EndpointConfigName: `${deployment.externalDeploymentId}-config`,
        }).promise();
      } catch (error) {
        logger.error('Error deleting SageMaker resources:', error);
        // Continue with deletion even if SageMaker deletion fails
      }
    }

    await deployment.destroy();

    return true;
  }

  async getDeploymentMetrics(userId, deploymentId) {
    const deployment = await this.getDeploymentById(userId, deploymentId);
    
    if (!deployment.externalDeploymentId) {
      return deployment.metrics || {};
    }

    try {
      // Get metrics from CloudWatch
      const cloudwatch = new AWS.CloudWatch();
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 3600000); // Last hour

      const metrics = await cloudwatch.getMetricStatistics({
        Namespace: 'AWS/SageMaker',
        MetricName: 'Invocations',
        Dimensions: [
          {
            Name: 'EndpointName',
            Value: deployment.externalDeploymentId,
          },
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300, // 5 minutes
        Statistics: ['Sum', 'Average'],
      }).promise();

      return {
        invocations: metrics.Datapoints || [],
        traffic: deployment.traffic,
        resourceUsage: deployment.resourceUsage,
        healthStatus: deployment.healthStatus,
      };
    } catch (error) {
      logger.error('Error getting deployment metrics:', error);
      return deployment.metrics || {};
    }
  }

  async getDeploymentStatistics(userId) {
    const stats = await Deployment.findAll({
      where: { userId },
      attributes: [
        'status',
        'environment',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('SUM', Sequelize.col('cost')), 'totalCost'],
      ],
      group: ['status', 'environment'],
    });

    const activeDeployments = await Deployment.count({
      where: { userId, status: 'active' },
    });

    const totalCost = stats.reduce((sum, stat) => sum + parseFloat(stat.dataValues.totalCost || 0), 0);

    return {
      activeDeployments,
      totalCost,
      byEnvironment: stats.reduce((acc, stat) => {
        const env = stat.environment;
        if (!acc[env]) acc[env] = {};
        acc[env][stat.status] = parseInt(stat.dataValues.count);
        return acc;
      }, {}),
    };
  }
  async updateDeployment(deploymentId, updateData) {
  const deployment = await Deployment.findByPk(deploymentId);
  if (!deployment) {
    throw new AppError('Deployment not found', 404);
  }

  const allowedUpdates = [
    'status', 'endpoint', 'apiKey', 'metrics', 'resourceUsage',
    'traffic', 'healthStatus', 'cost', 'externalDeploymentId',
  ];
  
  const updates = {};
  allowedUpdates.forEach(field => {
    if (updateData[field] !== undefined) {
      updates[field] = updateData[field];
    }
  });

  if (updateData.status === 'active' && !deployment.deployedAt) {
    updates.deployedAt = new Date();
  }

  const previousStatus = deployment.status;
  await deployment.update(updates);

  // Emit completion event if status changed to active
  if (previousStatus !== 'active' && deployment.status === 'active') {
    eventEmitter.emit(EVENT_TYPES.DEPLOYMENT_COMPLETED, deployment);
  } else if (previousStatus !== 'failed' && deployment.status === 'failed') {
    eventEmitter.emit(EVENT_TYPES.DEPLOYMENT_FAILED, deployment);
  }

  return deployment;
}
}

export default new DeploymentService();