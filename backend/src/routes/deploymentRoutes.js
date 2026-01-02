import { Router } from 'express';
import deploymentController from '../controllers/deploymentController.js';
import { validate } from '../core/middleware/validation.js';
import { schemas } from '../core/utils/validator.js';
import { deploymentLimiter } from '../core/middleware/rateLimiter.js';

const router = Router();

// Deployment operations
router.post('/',
  deploymentLimiter,
  validate(schemas.createDeployment),
  deploymentController.createDeployment
);

router.get('/',
  deploymentController.getDeployments
);

router.get('/statistics',
  deploymentController.getDeploymentStatistics
);

router.get('/:id',
  deploymentController.getDeployment
);

router.put('/:id/scale',
  deploymentController.scaleDeployment
);

router.delete('/:id',
  deploymentController.deleteDeployment
);

router.get('/:id/metrics',
  deploymentController.getDeploymentMetrics
);

// Prediction endpoint
router.post('/:id/predict',
  deploymentController.makePrediction
);

// Monitoring webhooks
router.post('/:id/status',
  deploymentController.updateDeploymentStatus
);

router.post('/:id/health',
  deploymentController.updateDeploymentHealth
);

export default router;