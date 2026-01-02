import { websocketServer } from './server.js';
import { WEBSOCKET_EVENTS } from '../core/events/eventTypes.js';
import { eventEmitter } from '../core/events/EventEmitter.js';

export const setupWebSocketEvents = () => {
  // Training events
  eventEmitter.on('training.started', (job) => {
    websocketServer.emitToUser(job.userId, WEBSOCKET_EVENTS.TRAINING_UPDATE, {
      jobId: job.id,
      status: 'started',
      progress: 0,
      message: 'Training started',
    });
  });

  eventEmitter.on('training.progress', (progress) => {
    websocketServer.emitToUser(progress.userId, WEBSOCKET_EVENTS.TRAINING_UPDATE, {
      jobId: progress.jobId,
      status: 'progress',
      progress: progress.progress,
      message: progress.message,
    });
  });

  eventEmitter.on('training.completed', (job) => {
    websocketServer.emitToUser(job.userId, WEBSOCKET_EVENTS.TRAINING_UPDATE, {
      jobId: job.id,
      status: 'completed',
      progress: 100,
      message: 'Training completed successfully',
      metrics: job.trainingMetrics,
    });
  });

  eventEmitter.on('training.failed', ({ job, error }) => {
    websocketServer.emitToUser(job.userId, WEBSOCKET_EVENTS.TRAINING_UPDATE, {
      jobId: job.id,
      status: 'failed',
      progress: job.progress,
      message: `Training failed: ${error.message}`,
    });
  });

  // Deployment events
  eventEmitter.on('deployment.started', (deployment) => {
    websocketServer.emitToUser(deployment.userId, WEBSOCKET_EVENTS.DEPLOYMENT_UPDATE, {
      deploymentId: deployment.id,
      status: 'started',
      message: 'Deployment started',
    });
  });

  eventEmitter.on('deployment.completed', (deployment) => {
    websocketServer.emitToUser(deployment.userId, WEBSOCKET_EVENTS.DEPLOYMENT_UPDATE, {
      deploymentId: deployment.id,
      status: 'completed',
      message: 'Deployment completed',
      endpoint: deployment.endpoint,
    });
  });

  eventEmitter.on('deployment.failed', (deployment) => {
    websocketServer.emitToUser(deployment.userId, WEBSOCKET_EVENTS.DEPLOYMENT_UPDATE, {
      deploymentId: deployment.id,
      status: 'failed',
      message: 'Deployment failed',
    });
  });

  // Evaluation events
  eventEmitter.on('evaluation.completed', (evaluation) => {
    websocketServer.emitToUser(evaluation.userId, WEBSOCKET_EVENTS.EVALUATION_UPDATE, {
      evaluationId: evaluation.id,
      status: 'completed',
      message: 'Evaluation completed',
      overallScore: evaluation.getOverallScore(),
    });
  });

  // Notification events
  eventEmitter.on('model.created', (model) => {
    websocketServer.emitToUser(model.userId, WEBSOCKET_EVENTS.NOTIFICATION, {
      type: 'info',
      title: 'Model Created',
      message: `Model "${model.name}" has been created successfully`,
      timestamp: new Date().toISOString(),
    });
  });

  eventEmitter.on('system.warning', (warning) => {
    websocketServer.emitToAdmins(WEBSOCKET_EVENTS.NOTIFICATION, {
      type: 'warning',
      title: 'System Warning',
      message: warning.message,
      timestamp: new Date().toISOString(),
    });
  });

  eventEmitter.on('system.error', (error) => {
    websocketServer.emitToAdmins(WEBSOCKET_EVENTS.NOTIFICATION, {
      type: 'error',
      title: 'System Error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  });
};