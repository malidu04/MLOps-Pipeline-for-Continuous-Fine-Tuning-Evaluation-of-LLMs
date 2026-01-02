import logger from '../../core/utils/logger.js';
import evaluationService from '../../services/evaluationService.js';
import axios from 'axios';
import config from '../../config/index.js';

class EvaluationProcessor {
  async handleEvaluation(job) {
    const { evaluationId, userId, modelId, evaluationData } = job.data;
    
    logger.info(`Starting evaluation job ${evaluationId}`, { userId, modelId });
    
    try {
      // 1. Prepare evaluation request
      const requestData = {
        evaluationId,
        modelId,
        datasetId: evaluationData.datasetId,
        metrics: evaluationData.metrics || ['accuracy', 'precision', 'recall', 'f1'],
      };

      // 2. Call ML Pipeline API
      const response = await axios.post(
        `${config.environment.mlPipelineUrl}/api/evaluation/run`,
        requestData,
        {
          timeout: 300000, // 5 minutes
        }
      );

      // 3. Update evaluation with external ID
      await evaluationService.updateEvaluation(evaluationId, {
        status: 'running',
        externalJobId: response.data.jobId,
      });

      return {
        success: true,
        externalJobId: response.data.jobId,
        message: 'Evaluation job submitted to ML pipeline',
      };
      
    } catch (error) {
      logger.error(`Evaluation job ${evaluationId} failed:`, error);
      
      // Update evaluation status
      await evaluationService.updateEvaluation(evaluationId, {
        status: 'failed',
        notes: error.message,
      });
      
      throw error;
    }
  }

  async runBatchEvaluation(job) {
    const { evaluationIds } = job.data;
    
    try {
      const results = [];
      
      for (const evaluationId of evaluationIds) {
        try {
          const result = await this.handleEvaluation({
            data: { evaluationId, ...job.data },
          });
          results.push({ evaluationId, success: true, result });
        } catch (error) {
          results.push({ evaluationId, success: false, error: error.message });
        }
      }
      
      return {
        success: true,
        results,
        total: evaluationIds.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      };
    } catch (error) {
      logger.error('Batch evaluation failed:', error);
      throw error;
    }
  }
}

export default new EvaluationProcessor();