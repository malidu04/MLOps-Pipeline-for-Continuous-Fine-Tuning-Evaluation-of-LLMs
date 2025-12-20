import { EventEmitter as NodeEventEmitter } from 'events';
import logger from '../utils/logger.js';
import { resolve } from 'path';

class EventEmitter extends NodeEventEmitter {
    emit(event, ...args) {
        logger.debug(`Event emitted: ${event}`, { event, args });
        return super.emit(event, ...args);
    }
    emitAsync(event, ...args) {
        return new Promise((resolve, reject) => {
            const listeners = this.listeners(event);
            if(listeners.length === 0) {
                resolve([]);
                return;
            }

            const promises = listeners.map(listener =>
                Promise.resolve(listener(...args)).catch(error => {
                    logger.error(`Error in event listener for ${event}:`, error);
                    return error;
                })
            );

            Promise.all(promises)
                .then(results => resolve(results))
                .catch(reject);
        });
    }
}

export const eventEmitter = new EventEmitter();
export default eventEmitter;