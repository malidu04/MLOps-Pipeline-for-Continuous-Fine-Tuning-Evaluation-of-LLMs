import { DataTypes, Model } from 'sequelize';

class Deployment extends Model {
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
        environment: {
          type: DataTypes.ENUM('development', 'staging', 'production'),
          defaultValue: 'development',
        },
        status: {
          type: DataTypes.ENUM(
            'pending',
            'deploying',
            'active',
            'updating',
            'failed',
            'scaled',
            'inactive'
          ),
          defaultValue: 'pending',
        },
        endpoint: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        apiKey: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        scalingConfig: {
          type: DataTypes.JSONB,
          defaultValue: {
            minInstances: 1,
            maxInstances: 3,
            targetUtilization: 70,
          },
        },
        resourceUsage: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        metrics: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        traffic: {
          type: DataTypes.JSONB,
          defaultValue: {
            requests: 0,
            errors: 0,
            latency: 0,
          },
        },
        healthStatus: {
          type: DataTypes.ENUM('healthy', 'unhealthy', 'degraded', 'unknown'),
          defaultValue: 'unknown',
        },
        lastHealthCheck: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        cost: {
          type: DataTypes.DECIMAL(10, 4),
          defaultValue: 0,
        },
        externalDeploymentId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        deployedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        scaledAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'Deployment',
        tableName: 'deployments',
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
  }

  async updateTraffic(requestCount, errorCount, latency) {
    this.traffic = {
      requests: (this.traffic?.requests || 0) + requestCount,
      errors: (this.traffic?.errors || 0) + errorCount,
      latency: latency,
    };
    await this.save();
  }

  async updateHealth(status) {
    this.healthStatus = status;
    this.lastHealthCheck = new Date();
    await this.save();
  }

  async scale(newConfig) {
    this.scalingConfig = { ...this.scalingConfig, ...newConfig };
    this.status = 'scaled';
    this.scaledAt = new Date();
    await this.save();
  }

  getUptime() {
    if (!this.deployedAt) return 0;
    const now = new Date();
    const deployed = new Date(this.deployedAt);
    return Math.floor((now - deployed) / 1000);
  }
}

export default Deployment;