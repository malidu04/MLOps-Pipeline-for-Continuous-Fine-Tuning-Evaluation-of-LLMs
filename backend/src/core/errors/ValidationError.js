import { AppError } from "./AppError.js";


export class ValidationError extends AppError {
    constructor (message, errors = []) {
        super(message, 400);
        this.errors = errors;
        this.name = 'ValidationError';
    }
}