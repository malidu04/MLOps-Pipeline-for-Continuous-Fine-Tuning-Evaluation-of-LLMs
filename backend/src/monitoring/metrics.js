import client from 'prom-client';
import logger from '../core/utils/logger.js';

// Enable default metrics
client.collectDefaultMetrics();

// Custom metrics
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const trainingJobsCounter = new client.Counter({
  name: 'training_jobs_total',
  help: 'Total number of training jobs',
  labelNames: ['status'],
});

const deploymentCounter = new client.Counter({
  name: 'deployments_total',
  help: 'Total number of deployments',
  labelNames: ['status', 'environment'],
});

const activeConnectionsGauge = new client.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections',
});

const databaseQueryDuration = new client.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
});

// Metrics collection middleware
export const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationInSeconds = duration[0] + duration[1] / 1e9;
    
    httpRequestDurationMicroseconds
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(durationInSeconds);
    
    httpRequestsTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .inc();
  });
  
  next();
};

// Metrics endpoint
export const getMetrics = async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).send('Error generating metrics');
  }
};

// Helper functions to update metrics
export const incrementTrainingJob = (status) => {
  trainingJobsCounter.labels(status).inc();
};

export const incrementDeployment = (status, environment) => {
  deploymentCounter.labels(status, environment).inc();
};

export const updateActiveConnections = (count) => {
  activeConnectionsGauge.set(count);
};

export const recordDatabaseQuery = (operation, table, duration) => {
  databaseQueryDuration.labels(operation, table).observe(duration);
};

// Custom metric collection
export const collectCustomMetrics = async () => {
  try {
    const { sequelize } = await import('../database/index.js');
    const { User, ModelVersion, TrainingJob, Deployment } = await import('../database/models/index.js');
    
    const metrics = {
      users_total: await User.count(),
      models_total: await ModelVersion.count(),
      training_jobs_active: await TrainingJob.count({ where: { status: ['pending', 'training'] } }),
      deployments_active: await Deployment.count({ where: { status: 'active' } }),
    };
    
    // Update gauge metrics
    for (const [name, value] of Object.entries(metrics)) {
      const gauge = client.register.getSingleMetric(name) || new client.Gauge({
        name,
        help: `Custom metric: ${name}`,
      });
      gauge.set(value);
    }
    
    return metrics;
  } catch (error) {
    logger.error('Error collecting custom metrics:', error);
    return {};
  }
};

export default {
  metricsMiddleware,
  getMetrics,
  incrementTrainingJob,
  incrementDeployment,
  updateActiveConnections,
  recordDatabaseQuery,
  collectCustomMetrics,
};