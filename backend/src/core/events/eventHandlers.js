import { EVENT_TYPES } from './eventTypes.js';
import { eventEmitter } from './EventEmitter.js';
import logger from '../utils/logger.js';
import { AuditLog } from '../../database/models/AuditLog.js';
import { websocketServer } from '../../websocket/server.js';
import { WEBSOCKET_EVENTS } from './eventTypes.js';

// Register event handlers
eventEmitter.on(EVENT_TYPES.MODEL_CREATED, async (model) => {
  try {
    await AuditLog.create({
      userId: model.userId,
      action: 'MODEL_CREATED',
      entityType: 'Model',
      entityId: model.id,
      details: { modelName: model.name },
    });
    
    websocketServer.emitToUser(model.userId, WEBSOCKET_EVENTS.NOTIFICATION, {
      type: 'info',
      message: `Model "${model.name}" created successfully`,
    });
  } catch (error) {
    logger.error('Error handling MODEL_CREATED event:', error);
  }
});

eventEmitter.on(EVENT_TYPES.TRAINING_PROGRESS, async (progress) => {
  try {
    websocketServer.emitToUser(progress.userId, WEBSOCKET_EVENTS.TRAINING_UPDATE, {
      jobId: progress.jobId,
      progress: progress.progress,
      status: progress.status,
      message: progress.message,
    });
  } catch (error) {
    logger.error('Error handling TRAINING_PROGRESS event:', error);
  }
});

eventEmitter.on(EVENT_TYPES.SYSTEM_ERROR, async (error) => {
  logger.error('System error event:', error);
  
  // Notify admins via WebSocket if needed
  websocketServer.emitToAdmins(WEBSOCKET_EVENTS.NOTIFICATION, {
    type: 'error',
    message: `System error: ${error.message}`,
    timestamp: new Date(),
  });
});

export { eventEmitter };