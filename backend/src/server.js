import dotenv from 'dotenv';
dotenv.config(); // MUST be first

import http from 'http';
import config from './config/index.js';
import { app, initializeApp } from './app.js';
import logger from './core/utils/logger.js';
import websocketServer from './websocket/server.js';
import scheduler from './jobs/scheduler.js';

const startServer = async () => {
  try {
    // Initialize app (DB, middleware, etc.)
    await initializeApp();

    // Debug configs
    console.log('🔍 Config object at startup:', config);
    console.log('🔍 Database config:', config.database);

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize WebSocket server
    websocketServer.initialize(server);

    // Start HTTP server
    const PORT = config.server.port || 3000;
    server.listen(PORT, () => {
      logger.info(`
╔══════════════════════════════════════════════════════════╗
║                 ML Platform Backend Started              ║
╠══════════════════════════════════════════════════════════╣
║ 🚀 Server running on: http://localhost:${PORT}              ║
║ 📊 Environment: ${config.environment.isProduction ? 'Production' : 'Development'} 
║ 🗄️  Database: ${config.database.database || 'Not Configured'}    ║
║ 🔗 WebSocket: ws://localhost:${PORT}/ws                  ║
║ 📈 Metrics: http://localhost:${PORT}/metrics            ║
║ ❤️  Health: http://localhost:${PORT}/health             ║
╚══════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      try {
        logger.info(`\n${signal} received. Starting graceful shutdown...`);

        server.close(async () => {
          logger.info('HTTP server closed');

          // Stop scheduler
          if (scheduler?.stop) {
            scheduler.stop();
            logger.info('Scheduler stopped');
          }

          // Close DB
          try {
            const { sequelize } = await import('./database/index.js');
            if (sequelize) {
              await sequelize.close();
              logger.info('Database connections closed');
            }
          } catch (dbError) {
            logger.error('Error closing database:', dbError);
          }

          // Close Redis
          try {
            const redisClient = await import('./database/redisClient.js');
            if (redisClient?.default) {
              await redisClient.default.quit();
              logger.info('Redis connection closed');
            }
          } catch (redisError) {
            logger.error('Error closing Redis:', redisError);
          }

          // Close WebSocket server
          try {
            if (websocketServer?.wss) {
              websocketServer.wss.close(() => {
                logger.info('WebSocket server closed');
              });
            }
          } catch (wsError) {
            logger.error('Error closing WebSocket:', wsError);
          }

          logger.info('Graceful shutdown complete');
          process.exit(0);
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
          logger.error('Forcefully shutting down after timeout');
          process.exit(1);
        }, 10000);
      } catch (shutdownError) {
        logger.error('Shutdown error:', shutdownError);
        process.exit(1);
      }
    };

    // Signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start server immediately
startServer();

export default app;
