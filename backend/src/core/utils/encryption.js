import crypto from 'crypto';
import bcrypt from 'bcrypt';
import config from '../../config/index.js';

const algorithm = 'aes-256-gcm';
const ivLength = 16;
const saltRounds = config.environment.bcryptRounds;

export const encrypt = (text, secretKey) => {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    content: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
};

export const decrypt = (encryptedData, secretKey) => {
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(secretKey),
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

export const hashPassword = async (password) => {
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const generateApiKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};