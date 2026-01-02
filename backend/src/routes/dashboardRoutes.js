import { Router } from 'express';
import dashboardController from '../controllers/dashboardController.js';

const router = Router();

// Dashboard data endpoints
router.get('/overview',
  dashboardController.getOverview
);

router.get('/cost-analysis',
  dashboardController.getCostAnalysis
);

router.get('/performance-metrics',
  dashboardController.getPerformanceMetrics
);

router.get('/alerts',
  dashboardController.getAlerts
);

router.get('/resource-usage',
  dashboardController.getResourceUsage
);

router.get('/recent-activity',
  dashboardController.getRecentActivity
);

router.post('/estimate-cost',
  dashboardController.estimateCost
);

export default router;