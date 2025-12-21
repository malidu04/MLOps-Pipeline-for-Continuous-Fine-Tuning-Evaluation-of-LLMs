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
    
}