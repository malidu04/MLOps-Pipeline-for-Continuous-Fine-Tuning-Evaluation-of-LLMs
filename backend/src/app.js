import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import config from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './core/middleware/errorHandler.js';
import { requestLogger, logRequest } from './core/middleware/logger.js';
import { metricsMiddleware } from './monitoring/metrics.js';
import healthCheckRouter from './monitoring/healthCheck.js';
import logger from './core/utils/logger.js';
import { initializeDatabase } from './database/index.js';
import scheduler from './jobs/scheduler.js';
import { setupWebSocketEvents } from './websocket/events.js';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (config.environment.isDevelopment) {
  app.use(morgan('dev'));
}
app.use(requestLogger);
app.use(logRequest);

// Health checks
app.use('/health', healthCheckRouter);

// API routes
app.use('/api', routes);

// Static files (if needed)
app.use('/uploads', express.static('uploads'));

// Remove the problematic * route and use notFoundHandler instead
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Initialize application function
const initializeApp = async () => {
  logger.info('Initializing application...');
  
  await initializeDatabase();
  
  // Start scheduler
  if (!config.environment.isTest) {
    scheduler.start();
  }
  
  // Setup WebSocket events
  setupWebSocketEvents();
  
  logger.info('Application initialization completed');
};

export { app, initializeApp };