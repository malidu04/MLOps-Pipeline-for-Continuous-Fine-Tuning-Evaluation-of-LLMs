import { DataTypes, Model } from 'sequelize';

class Evaluation extends Model {
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
          type: DataTypes.ENUM('pending', 'running', 'completed', 'failed'),
          defaultValue: 'pending',
        },
        datasetInfo: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        metrics: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        confusionMatrix: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        classificationReport: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        predictions: {
          type: DataTypes.TEXT, // Could be JSON string or path to file
          allowNull: true,
        },
        driftMetrics: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        executionTime: {
          type: DataTypes.FLOAT,
          defaultValue: 0,
        },
        cost: {
          type: DataTypes.DECIMAL(10, 4),
          defaultValue: 0,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        externalJobId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'Evaluation',
        tableName: 'evaluations',
        timestamps: true,
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
    
    this.belongsTo(models.TrainingJob, {
      foreignKey: 'trainingJobId',
      as: 'trainingJob',
      allowNull: true,
    });
  }

  getOverallScore() {
    if (!this.metrics) return null;
    
    const scores = Object.values(this.metrics).filter(v => typeof v === 'number');
    if (scores.length === 0) return null;
    
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  toJSON() {
    const values = super.toJSON();
    values.overallScore = this.getOverallScore();
    return values;
  }
}

export default Evaluation;