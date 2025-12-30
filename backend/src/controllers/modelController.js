import modelService from '../services/modelService.js';
import { AppError } from '../core/errors/AppError.js';
import logger from '../core/utils/logger.js';

class ModelController {
  async createModel(req, res, next) {
    try {
      const modelData = req.validated;
      const model = await modelService.createModel(req.user.id, modelData);
      
      res.status(201).json({
        success: true,
        data: model,
      });
    } catch (error) {
      next(error);
    }
  }

  async getModels(req, res, next) {
    try {
      const filters = {
        status: req.query.status,
        taskType: req.query.taskType,
        tags: req.query.tags ? req.query.tags.split(',') : undefined,
        search: req.query.search,
      };

      const models = await modelService.getModels(req.user.id, filters);
      
      res.json({
        success: true,
        data: models,
      });
    } catch (error) {
      next(error);
    }
  }

  async getModel(req, res, next) {
    try {
      const model = await modelService.getModelById(req.user.id, req.params.id);
      
      res.json({
        success: true,
        data: model,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateModel(req, res, next) {
    try {
      const model = await modelService.updateModel(
        req.user.id,
        req.params.id,
        req.body
      );
      
      res.json({
        success: true,
        data: model,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteModel(req, res, next) {
    try {
      await modelService.deleteModel(req.user.id, req.params.id);
      
      res.json({
        success: true,
        message: 'Model deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadModelFile(req, res, next) {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      const result = await modelService.uploadModelFile(
        req.user.id,
        req.params.id,
        req.file
      );
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async downloadModelFile(req, res, next) {
    try {
      const model = await modelService.getModelById(req.user.id, req.params.id);
      
      if (!model.storagePath) {
        throw new AppError('Model file not found', 404);
      }

      // Set appropriate headers for file download
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${model.name}-${model.version}.model"`,
      });

      // Redirect to S3 or stream the file
      res.redirect(model.storagePath);
    } catch (error) {
      next(error);
    }
  }

  async getModelStatistics(req, res, next) {
    try {
      const stats = await modelService.getModelStatistics(req.user.id);
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ModelController();