import { DataTypes, Model } from 'sequelize';

class TrainingJob extends Model {
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
        status: {
          type: DataTypes.ENUM(
            'pending',
            'preprocessing',
            'training',
            'validating',
            'completed',
            'failed',
            'cancelled'
          ),
          defaultValue: 'pending',
        },
        progress: {
          type: DataTypes.FLOAT,
          defaultValue: 0,
          validate: {
            min: 0,
            max: 100,
          },
        },
        hyperparameters: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        datasetInfo: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        trainingMetrics: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        validationMetrics: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        logs: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        errorMessage: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        startTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        endTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        duration: {
          type: DataTypes.INTEGER, // seconds
          defaultValue: 0,
        },
        cost: {
          type: DataTypes.DECIMAL(10, 4),
          defaultValue: 0,
        },
        resourceUsage: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        externalJobId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'TrainingJob',
        tableName: 'training_jobs',
        timestamps: true,
        hooks: {
          beforeUpdate: (job) => {
            if (job.changed('status') && job.status === 'completed') {
              job.endTime = new Date();
              if (job.startTime) {
                job.duration = Math.floor((job.endTime - job.startTime) / 1000);
              }
            }
          },
        },
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    
    this.belongsTo(models.ModelVersion, {
      foreignKey: 'modelId',
      as: 'model',
    });
  }

  async updateProgress(progress, message = null) {
    this.progress = progress;
    if (message) {
      this.logs = (this.logs || '') + `\n[${new Date().toISOString()}] ${message}`;
    }
    await this.save();
  }

  async fail(error) {
    this.status = 'failed';
    this.errorMessage = error.message;
    this.endTime = new Date();
    await this.save();
  }

  async complete(metrics) {
    this.status = 'completed';
    this.trainingMetrics = metrics;
    this.progress = 100;
    this.endTime = new Date();
    if (this.startTime) {
      this.duration = Math.floor((this.endTime - this.startTime) / 1000);
    }
    await this.save();
  }
}

export default TrainingJob;