import { DataTypes, Model } from 'sequelize';

class ModelVersion extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        version: {
          type: DataTypes.STRING,
          defaultValue: '1.0.0',
        },
        baseModel: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        taskType: {
          type: DataTypes.ENUM('classification', 'regression', 'generation'),
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM('draft', 'training', 'trained', 'failed', 'archived'),
          defaultValue: 'draft',
        },
        parameters: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        metadata: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        storagePath: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        fileHash: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        size: {
          type: DataTypes.BIGINT,
          defaultValue: 0,
        },
        tags: {
          type: DataTypes.ARRAY(DataTypes.STRING),
          defaultValue: [],
        },
      },
      {
        sequelize,
        modelName: 'ModelVersion',
        tableName: 'model_versions',
        timestamps: true,
        indexes: [
          {
            fields: ['userId', 'name', 'version'],
            unique: true,
          },
          {
            fields: ['status'],
          },
          {
            fields: ['tags'],
            using: 'gin',
          },
        ],
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    
    this.hasMany(models.TrainingJob, {
      foreignKey: 'modelId',
      as: 'trainingJobs',
    });
    
    this.hasMany(models.Evaluation, {
      foreignKey: 'modelId',
      as: 'evaluations',
    });
    
    this.hasMany(models.Deployment, {
      foreignKey: 'modelId',
      as: 'deployments',
    });
  }

  getLatestTrainingJob() {
    return this.trainingJobs?.sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  getLatestEvaluation() {
    return this.evaluations?.sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  getActiveDeployment() {
    return this.deployments?.find(d => d.status === 'active');
  }
}

export default ModelVersion;