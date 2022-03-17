import { debuglog } from "util";

export const createLogger = (topic = 'default') => debuglog(`@newdash/inject:${topic}`);
