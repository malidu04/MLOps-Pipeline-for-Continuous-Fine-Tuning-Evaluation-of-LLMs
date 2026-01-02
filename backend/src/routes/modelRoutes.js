import { Router } from 'express';
import modelController from '../controllers/modelController.js';
import { validate } from '../core/middleware/validation.js';
import { schemas } from '../core/utils/validator.js';
import { validateFile } from '../core/middleware/validation.js';
import { authorize } from '../core/middleware/auth.js';
import multer from 'multer';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// Model CRUD operations
router.post('/',
  validate(schemas.createModel),
  modelController.createModel
);

router.get('/',
  modelController.getModels
);

router.get('/statistics',
  modelController.getModelStatistics
);

router.get('/:id',
  modelController.getModel
);

router.put('/:id',
  validate(schemas.createModel),
  modelController.updateModel
);

router.delete('/:id',
  modelController.deleteModel
);

// Model file operations
router.post('/:id/upload',
  upload.single('modelFile'),
  validateFile({
    required: true,
    maxSize: 100 * 1024 * 1024,
    allowedTypes: ['application/octet-stream', 'application/zip'],
  }),
  modelController.uploadModelFile
);

router.get('/:id/download',
  modelController.downloadModelFile
);

// Admin only routes
router.get('/admin/all',
  authorize('admin'),
  async (req, res, next) => {
    try {
      const { ModelVersion } = await import('../database/models/index.js');
      const models = await ModelVersion.findAll({
        include: [{ model: User, as: 'user', attributes: ['id', 'email'] }],
      });
      
      res.json({
        success: true,
        data: models,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;