import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import logger from '../core/utils/logger.js';
import { User } from '../database/models/index.js';
import { WEBSOCKET_EVENTS } from '../core/events/eventTypes.js';

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> WebSocket[]
    this.admins = new Set();
  }

  initialize(server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      clientTracking: true,
    });

    this.setupEventHandlers();
    logger.info('WebSocket server initialized');
  }

  setupEventHandlers() {
    this.wss.on('connection', (ws, request) => {
      logger.debug('New WebSocket connection attempt');

      // Extract token from query params
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(1008, 'Authentication token required');
        return;
      }

      this.authenticateConnection(ws, token);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });

    this.wss.on('close', () => {
      logger.info('WebSocket server closed');
    });
  }

  async authenticateConnection(ws, token) {
    try {
      const decoded = jwt.verify(token, config.environment.jwtSecret);
      const user = await User.findByPk(decoded.id, {
        attributes: ['id', 'email', 'role'],
      });

      if (!user) {
        ws.close(1008, 'User not found');
        return;
      }

      // Store connection
      this.addClient(user.id, ws);
      
      // Add to admin set if applicable
      if (user.role === 'admin') {
        this.admins.add(user.id);
      }

      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        userId: user.id,
        timestamp: new Date().toISOString(),
      }));

      logger.debug(`User ${user.id} connected via WebSocket`);

      // Setup message handler
      ws.on('message', (data) => this.handleMessage(user.id, data));
      
      // Setup close handler
      ws.on('close', () => this.removeClient(user.id, ws));
      
      // Setup error handler
      ws.on('error', (error) => {
        logger.error(`WebSocket error for user ${user.id}:`, error);
        this.removeClient(user.id, ws);
      });

    } catch (error) {
      logger.error('WebSocket authentication error:', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  addClient(userId, ws) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(ws);
  }

  removeClient(userId, ws) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(ws);
      if (userClients.size === 0) {
        this.clients.delete(userId);
        this.admins.delete(userId);
      }
    }
  }

  handleMessage(userId, data) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'ping':
          this.sendToUser(userId, {
            type: 'pong',
            timestamp: new Date().toISOString(),
          });
          break;
          
        case 'subscribe':
          this.handleSubscribe(userId, message);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscribe(userId, message);
          break;
          
        default:
          logger.warn(`Unknown WebSocket message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling WebSocket message:', error);
    }
  }

  handleSubscribe(userId, message) {
    const { channel } = message;
    
    // In a more complex implementation, you might track subscriptions
    logger.debug(`User ${userId} subscribed to channel: ${channel}`);
    
    this.sendToUser(userId, {
      type: 'subscribed',
      channel,
      timestamp: new Date().toISOString(),
    });
  }

  handleUnsubscribe(userId, message) {
    const { channel } = message;
    
    logger.debug(`User ${userId} unsubscribed from channel: ${channel}`);
    
    this.sendToUser(userId, {
      type: 'unsubscribed',
      channel,
      timestamp: new Date().toISOString(),
    });
  }

  // Public methods for emitting events
  emitToUser(userId, event, data) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const message = JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString(),
      });

      userClients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(message);
        }
      });
    }
  }

  emitToAdmins(event, data) {
    this.admins.forEach(adminId => {
      this.emitToUser(adminId, event, data);
    });
  }

  broadcast(event, data, excludeUserIds = []) {
    const message = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    this.clients.forEach((clients, userId) => {
      if (!excludeUserIds.includes(userId)) {
        clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(message);
          }
        });
      }
    });
  }

  sendToUser(userId, data) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const message = JSON.stringify(data);
      userClients.forEach(client => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    }
  }

  getStats() {
    return {
      totalConnections: Array.from(this.clients.values())
        .reduce((sum, clients) => sum + clients.size, 0),
      uniqueUsers: this.clients.size,
      adminCount: this.admins.size,
    };
  }
}

export const websocketServer = new WebSocketServer();
export default websocketServer;