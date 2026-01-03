import { Router } from 'express';
import trainingController from '../controllers/trainingController.js';
import { validate } from '../core/middleware/validation.js';
import { schemas } from '../core/utils/validator.js';
import { trainingLimiter } from '../core/middleware/rateLimiter.js';

const router = Router();

// Training job operations
router.post('/',
  trainingLimiter,
  validate(schemas.createTraining),
  trainingController.createTrainingJob
);

router.get('/',
  trainingController.getTrainingJobs
);

router.get('/statistics',
  trainingController.getTrainingStatistics
);

router.get('/:id',
  trainingController.getTrainingJob
);

router.post('/:id/cancel',
  trainingController.cancelTrainingJob
);

router.get('/:id/logs',
  trainingController.getTrainingLogs
);

// ML Pipeline webhook (public endpoint for pipeline callbacks)
router.post('/:id/progress',
  trainingController.updateTrainingProgress
);


export default router;