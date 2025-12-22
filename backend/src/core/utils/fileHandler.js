import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import archiver from 'archiver';
import extract from 'extract-zip';
import logger from './logger.js';

export const ensureDirectory = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

export const saveFile = async (file, destination, options = {}) => {
  await ensureDirectory(path.dirname(destination));
  
  if (file.buffer) {
    await fs.writeFile(destination, file.buffer);
  } else if (file.path) {
    await fs.copyFile(file.path, destination);
  } else {
    throw new Error('Invalid file object');
  }
  
  if (options.generateHash) {
    const hash = await calculateFileHash(destination);
    return { path: destination, hash };
  }
  
  return { path: destination };
};

export const calculateFileHash = async (filePath, algorithm = 'sha256') => {
  const hash = crypto.createHash(algorithm);
  const stream = createReadStream(filePath);
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

export const compressDirectory = async (sourceDir, destPath) => {
  await ensureDirectory(path.dirname(destPath));
  
  const output = createWriteStream(destPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  return new Promise((resolve, reject) => {
    output.on('close', () => {
      logger.info(`Compressed ${sourceDir} to ${destPath} (${archive.pointer()} bytes)`);
      resolve(destPath);
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
};

export const extractZip = async (zipPath, destDir) => {
  await ensureDirectory(destDir);
  await extract(zipPath, { dir: destDir });
  return destDir;
};

export const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    logger.debug(`Deleted file: ${filePath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

export const deleteDirectory = async (dirPath) => {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.debug(`Deleted directory: ${dirPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

export const getFileInfo = async (filePath) => {
  const stats = await fs.stat(filePath);
  return {
    path: filePath,
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
    isDirectory: stats.isDirectory(),
  };
};