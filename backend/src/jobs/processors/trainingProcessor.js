import logger from '../../core/utils/logger.js';
import trainingService from '../../services/trainingService.js';
import axios from 'axios';
import config from '../../config/index.js';
import FormData from 'form-data';
import fs from 'fs';

class TrainingProcessor {
  async handleTraining(job) {
    const { jobId, userId, modelId, trainingData } = job.data;
    
    logger.info(`Starting training job ${jobId}`, { userId, modelId });
    
    try {
      // 1. Prepare training data
      const formData = new FormData();
      formData.append('jobId', jobId);
      formData.append('userId', userId);
      formData.append('modelId', modelId);
      formData.append('hyperparameters', JSON.stringify(trainingData.hyperparameters));
      formData.append('epochs', trainingData.epochs);
      formData.append('batchSize', trainingData.batchSize);

      // 2. Call ML Pipeline API
      const response = await axios.post(
        `${config.environment.mlPipelineUrl}/api/training/start`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 300000, // 5 minutes
        }
      );

      // 3. Update job with external ID
      await trainingService.updateTrainingProgress(jobId, 10, 'Training started in ML pipeline');
      
      const externalJobId = response.data.jobId;
      await trainingService.getTrainingJobById(userId, jobId).then(async (job) => {
        await job.update({ externalJobId });
      });

      // 4. Poll for completion (simplified - in production use webhooks)
      // This is a simplified version. In production, use webhooks from ML pipeline
      
      return {
        success: true,
        externalJobId,
        message: 'Training job submitted to ML pipeline',
      };
      
    } catch (error) {
      logger.error(`Training job ${jobId} failed:`, error);
      
      // Update job status
      await trainingService.failTrainingJob(jobId, error);
      
      throw error;
    }
  }

  async cancelTraining(job) {
    const { externalJobId } = job.data;
    
    if (!externalJobId) {
      return { success: false, message: 'No external job ID found' };
    }

    try {
      await axios.post(`${config.environment.mlPipelineUrl}/api/training/cancel`, {
        jobId: externalJobId,
      });
      
      return { success: true, message: 'Training cancellation requested' };
    } catch (error) {
      logger.error(`Failed to cancel training job ${externalJobId}:`, error);
      throw error;
    }
  }
}

export default new TrainingProcessor();