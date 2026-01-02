import { Router } from 'express';
import authRoutes from './authRoutes.js';
import modelRoutes from './modelRoutes.js';
import trainingRoutes from './trainingRoutes.js';
import evaluationRoutes from './evaluationRoutes.js';
import deploymentRoutes from './deploymentRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import { authenticate } from '../core/middleware/auth.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ML Platform API',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/models', authenticate, modelRoutes);
router.use('/training', authenticate, trainingRoutes);
router.use('/evaluation', authenticate, evaluationRoutes);
router.use('/deployment', authenticate, deploymentRoutes);
router.use('/dashboard', authenticate, dashboardRoutes);

// 404 handler
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

export default router;