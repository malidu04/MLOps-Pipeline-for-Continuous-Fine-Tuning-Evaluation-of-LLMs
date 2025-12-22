import { DataTypes, Model } from 'sequelize';
import { hashPassword } from '../../core/utils/encryption.js';

class User extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            isEmail: true,
          },
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        firstName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        lastName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        role: {
          type: DataTypes.ENUM('admin', 'user', 'viewer'),
          defaultValue: 'user',
        },
        company: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        apiKey: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
        },
        status: {
          type: DataTypes.ENUM('active', 'suspended', 'inactive'),
          defaultValue: 'active',
        },
        lastLogin: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        preferences: {
          type: DataTypes.JSONB,
          defaultValue: {},
        },
      },
      {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
        hooks: {
          beforeCreate: async (user) => {
            if (user.password) {
              user.password = await hashPassword(user.password);
            }
          },
          beforeUpdate: async (user) => {
            if (user.changed('password')) {
              user.password = await hashPassword(user.password);
            }
          },
        },
      }
    );
  }

  static associate(models) {
    this.hasMany(models.ModelVersion, {
      foreignKey: 'userId',
      as: 'models',
    });
    
    this.hasMany(models.TrainingJob, {
      foreignKey: 'userId',
      as: 'trainingJobs',
    });
    
    this.hasMany(models.Deployment, {
      foreignKey: 'userId',
      as: 'deployments',
    });
    
    this.hasMany(models.AuditLog, {
      foreignKey: 'userId',
      as: 'auditLogs',
    });
  }

  toJSON() {
    const values = { ...this.get() };
    delete values.password;
    delete values.apiKey;
    return values;
  }

  async validatePassword(password) {
    const { comparePassword } = await import('../../core/utils/encryption.js');
    return comparePassword(password, this.password);
  }
}

export default User;