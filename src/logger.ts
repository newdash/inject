import { debug } from "debug";

export const createLogger = (topic = 'default') => debug(`@newdash/inject:${topic}`);
