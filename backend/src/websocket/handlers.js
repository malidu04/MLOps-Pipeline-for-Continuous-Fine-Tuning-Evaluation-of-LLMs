import { websocketServer } from './server.js';
import logger from '../core/utils/logger.js';

export const handleWebSocketMessage = (userId, message) => {
  try {
    const parsed = JSON.parse(message);
    
    switch (parsed.action) {
      case 'subscribe':
        return handleSubscribe(userId, parsed);
      case 'unsubscribe':
        return handleUnsubscribe(userId, parsed);
      case 'ping':
        return handlePing(userId);
      case 'get_stats':
        return handleGetStats(userId);
      default:
        logger.warn(`Unknown WebSocket action: ${parsed.action}`);
        return null;
    }
  } catch (error) {
    logger.error('Error handling WebSocket message:', error);
    return null;
  }
};

const handleSubscribe = (userId, data) => {
  const { channels } = data;
  
  if (!Array.isArray(channels)) {
    return {
      type: 'error',
      message: 'Channels must be an array',
    };
  }

  // In a real implementation, you would store subscriptions in Redis
  logger.info(`User ${userId} subscribed to channels: ${channels.join(', ')}`);
  
  return {
    type: 'subscribed',
    channels,
    timestamp: new Date().toISOString(),
  };
};

const handleUnsubscribe = (userId, data) => {
  const { channels } = data;
  
  logger.info(`User ${userId} unsubscribed from channels: ${channels?.join(', ') || 'all'}`);
  
  return {
    type: 'unsubscribed',
    channels,
    timestamp: new Date().toISOString(),
  };
};

const handlePing = (userId) => {
  return {
    type: 'pong',
    timestamp: new Date().toISOString(),
  };
};

const handleGetStats = (userId) => {
  const stats = websocketServer.getStats();
  
  return {
    type: 'stats',
    stats,
    timestamp: new Date().toISOString(),
  };
};