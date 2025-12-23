import { DataTypes, Model } from 'sequelize';

class AuditLog extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        action: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        entityType: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        entityId: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        details: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
        ipAddress: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        userAgent: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM('success', 'failure', 'warning'),
          defaultValue: 'success',
        },
        errorMessage: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'AuditLog',
        tableName: 'audit_logs',
        timestamps: true,
        indexes: [
          {
            fields: ['userId', 'createdAt'],
          },
          {
            fields: ['action'],
          },
          {
            fields: ['entityType', 'entityId'],
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
  }
}

export default AuditLog;