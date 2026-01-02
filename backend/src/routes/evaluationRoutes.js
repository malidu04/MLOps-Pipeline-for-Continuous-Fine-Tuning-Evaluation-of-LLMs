import { Router } from "express";
import evaluationController from '../controllers/evaluationController.js';
import { validate } from '../core/middleware/validation.js';
import { schemas } from '../core/utils/validator.js';

const router = Router();

router.post('/',
    validate(schemas.createEvaluation),
    evaluationController.createEvaluation
);

router.get('/', 
    evaluationController.getEvaluations
);

router.get('/statistics',
    evaluationController.getEvaluationStatistics
);

router.get('/:id',
    evaluationController.getEvaluation
);

router.post('/drift-detection',
    evaluationController.runDriftDetection
);

router.post('/compare',
    evaluationController.compareEvaluations
);

router.post('/:id/results',
  evaluationController.updateEvaluationResults
);

export default router;