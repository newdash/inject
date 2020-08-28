import { MSG_ERR_PARAM_REQUIRED } from "./constants";
import { createLogger } from "./logger";
import { getClassName, isClass } from "./utils";


const errorLogger = createLogger("error");

class BaseError extends Error {

}

/**
 * some instance is required,
 * but the container can not provided
 */
export class RequiredNotFoundError extends BaseError {

  /**
   * 
   * @param target inject target
   * @param targetKey inject target key
   * @param parameterIndex  inject parameter index
   */
  constructor(target: any, targetKey?: string, parameterIndex?: number) {

    const className = typeof target == 'string' ? target : getClassName(target);

    const methodOrProperty = targetKey;
    let callExpr = '';

    if (isClass(target)) {
      callExpr += "static ";
    }

    if (parameterIndex != undefined) {
      callExpr += `${className}.${methodOrProperty || "constructor"}(${parameterIndex})`;
    } else {
      callExpr += `${className}.${methodOrProperty}`;
    }

    super(`${callExpr} inject failed, ${MSG_ERR_PARAM_REQUIRED}`);

    errorLogger(this.message);

  }

}

export class ResourceBusyError extends BaseError {

}