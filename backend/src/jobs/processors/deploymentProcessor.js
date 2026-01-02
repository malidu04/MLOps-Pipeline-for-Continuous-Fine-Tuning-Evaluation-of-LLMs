import logger from '../../core/utils/logger.js';
import deploymentService from '../../services/deploymentService.js';
import modelService from '../../services/modelService.js';
import axios from 'axios';
import config from '../../config/index.js';

class DeploymentProcessor {
  async handleDeployment(job) {
    const { deploymentId, userId, modelId, deploymentData } = job.data;
    
    logger.info(`Starting deployment job ${deploymentId}`, { userId, modelId });
    
    try {
      // 1. Get model and deployment details
      const model = await modelService.getModelById(userId, modelId);
      const deployment = await deploymentService.getDeploymentById(userId, deploymentId);
      
      if (!model.storagePath) {
        throw new Error('Model file not found. Please upload model file first.');
      }

      // 2. Update deployment status
      await deployment.update({ status: 'deploying' });

      // 3. Call ML Pipeline for deployment
      const requestData = {
        deploymentId,
        modelId,
        modelPath: model.storagePath,
        environment: deploymentData.environment,
        scalingConfig: deploymentData.scalingConfig,
      };

      const response = await axios.post(
        `${config.environment.mlPipelineUrl}/api/deployment/deploy`,
        requestData,
        {
          timeout: 600000, // 10 minutes for deployment
        }
      );

      // 4. Update deployment with endpoint and API key
      const { endpoint, apiKey, externalDeploymentId } = response.data;
      
      await deploymentService.updateDeployment(deploymentId, {
        endpoint,
        apiKey,
        externalDeploymentId,
        status: 'active',
      });

      // 5. Start health monitoring
      this.startHealthMonitoring(deploymentId, endpoint);

      return {
        success: true,
        endpoint,
        externalDeploymentId,
        message: 'Deployment completed successfully',
      };
      
    } catch (error) {
      logger.error(`Deployment job ${deploymentId} failed:`, error);
      
      // Update deployment status
      await deploymentService.updateDeployment(deploymentId, {
        status: 'failed',
      });
      
      throw error;
    }
  }

  async startHealthMonitoring(deploymentId, endpoint) {
    // Start periodic health checks
    const interval = setInterval(async () => {
      try {
        const healthResponse = await axios.get(`${endpoint}/health`, {
          timeout: 5000,
        });
        
        await deploymentService.updateDeployment(deploymentId, {
          healthStatus: healthResponse.data.status === 'healthy' ? 'healthy' : 'unhealthy',
          lastHealthCheck: new Date(),
        });
        
      } catch (error) {
        await deploymentService.updateDeployment(deploymentId, {
          healthStatus: 'unhealthy',
          lastHealthCheck: new Date(),
        });
      }
    }, 30000); // Check every 30 seconds

    // Store interval reference for cleanup
    this.healthCheckIntervals = this.healthCheckIntervals || new Map();
    this.healthCheckIntervals.set(deploymentId, interval);
  }

  async stopHealthMonitoring(deploymentId) {
    if (this.healthCheckIntervals && this.healthCheckIntervals.has(deploymentId)) {
      clearInterval(this.healthCheckIntervals.get(deploymentId));
      this.healthCheckIntervals.delete(deploymentId);
    }
  }

  async scaleDeployment(job) {
    const { deploymentId, userId, scalingConfig } = job.data;
    
    try {
      const deployment = await deploymentService.getDeploymentById(userId, deploymentId);
      
      // Call ML Pipeline for scaling
      const response = await axios.post(
        `${config.environment.mlPipelineUrl}/api/deployment/scale`,
        {
          deploymentId: deployment.externalDeploymentId,
          scalingConfig,
        }
      );

      // Update deployment
      await deploymentService.scaleDeployment(userId, deploymentId, scalingConfig);

      return {
        success: true,
        message: 'Deployment scaled successfully',
        scalingConfig,
      };
    } catch (error) {
      logger.error(`Scaling deployment ${deploymentId} failed:`, error);
      throw error;
    }
  }
}

export default new DeploymentProcessor();