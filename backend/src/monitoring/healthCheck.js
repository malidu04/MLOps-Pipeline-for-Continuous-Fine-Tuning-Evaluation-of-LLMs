import { Router } from 'express';
import { testConnection } from '../database/index.js';
import redisClient from '../database/redisClient.js';
import logger from '../core/utils/logger.js';
import axios from 'axios';
import config from '../config/index.js';

const router = Router();

// Basic health check
router.get('/health', async (req, res) => {
  try {
    const checks = {
      api: 'healthy',
      database: await checkDatabase(),
      redis: await checkRedis(),
      mlPipeline: await checkMLPipeline(),
      aws: await checkAWS(),
    };

    const allHealthy = Object.values(checks).every(status => status === 'healthy');
    const status = allHealthy ? 'healthy' : 'degraded';

    res.json({
      status,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Liveness probe
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe
router.get('/ready', async (req, res) => {
  try {
    const dbReady = await checkDatabase();
    const redisReady = await checkRedis();
    
    if (dbReady === 'healthy' && redisReady === 'healthy') {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbReady,
          redis: redisReady,
        },
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Detailed system status
router.get('/status', async (req, res) => {
  try {
    const status = await getDetailedStatus();
    res.json(status);
  } catch (error) {
    logger.error('Status check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Helper functions
async function checkDatabase() {
  try {
    await testConnection();
    return 'healthy';
  } catch (error) {
    logger.error('Database health check failed:', error);
    return 'unhealthy';
  }
}

async function checkRedis() {
  try {
    await redisClient.ping();
    return 'healthy';
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return 'unhealthy';
  }
}

async function checkMLPipeline() {
  try {
    const response = await axios.get(`${config.environment.mlPipelineUrl}/health`, {
      timeout: 5000,
    });
    return response.status === 200 ? 'healthy' : 'unhealthy';
  } catch (error) {
    logger.error('ML Pipeline health check failed:', error);
    return 'unhealthy';
  }
}

async function checkAWS() {
  try {
    const AWS = await import('aws-sdk');
    const sts = new AWS.STS();
    await sts.getCallerIdentity().promise();
    return 'healthy';
  } catch (error) {
    logger.error('AWS health check failed:', error);
    return 'unhealthy';
  }
}

async function getDetailedStatus() {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  const [dbStatus, redisStatus, mlPipelineStatus, awsStatus] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkMLPipeline(),
    checkAWS(),
  ]);

  return {
    status: dbStatus === 'healthy' && redisStatus === 'healthy' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.floor(uptime),
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      env: process.env.NODE_ENV,
    },
    services: {
      database: dbStatus,
      redis: redisStatus,
      mlPipeline: mlPipelineStatus,
      aws: awsStatus,
    },
    metrics: {
      activeRequests: 0, // You would track this in production
      activeConnections: 0, // You would track this in production
    },
  };
}

export default router;