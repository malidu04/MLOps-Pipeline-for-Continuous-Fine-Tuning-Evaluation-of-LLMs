import { AppError } from './AppError';

export class NotFoundError extends AppError {
    constructor (resource) {
        super(`${resource} not found`, 400);
        this.name = 'NotFoundError';
    }
}