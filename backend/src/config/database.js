export default {
  dialect: process.env.DB_DIALECT || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'ml_user',
  password: process.env.DB_PASSWORD || 'strongpassword',
  database: process.env.DB_NAME || 'ml_platform',

  logging: process.env.NODE_ENV === 'development' ? console.log : false,

  define: {
    timestamps: true,
    underscored: true,
  },

  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};
