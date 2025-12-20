export const EVENT_TYPES = {
  // Model Events
  MODEL_CREATED: 'model.created',
  MODEL_UPDATED: 'model.updated',
  MODEL_DELETED: 'model.deleted',
  
  // Training Events
  TRAINING_STARTED: 'training.started',
  TRAINING_COMPLETED: 'training.completed',
  TRAINING_FAILED: 'training.failed',
  TRAINING_PROGRESS: 'training.progress',
  
  // Evaluation Events
  EVALUATION_STARTED: 'evaluation.started',
  EVALUATION_COMPLETED: 'evaluation.completed',
  EVALUATION_FAILED: 'evaluation.failed',
  
  // Deployment Events
  DEPLOYMENT_STARTED: 'deployment.started',
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  DEPLOYMENT_FAILED: 'deployment.failed',
  
  // User Events
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  
  // System Events
  SYSTEM_WARNING: 'system.warning',
  SYSTEM_ERROR: 'system.error',
  METRICS_UPDATED: 'metrics.updated',
};

export const WEBSOCKET_EVENTS = {
  TRAINING_UPDATE: 'training_update',
  DEPLOYMENT_UPDATE: 'deployment_update',
  EVALUATION_UPDATE: 'evaluation_update',
  NOTIFICATION: 'notification',
};