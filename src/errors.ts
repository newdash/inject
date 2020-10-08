import { MSG_ERR_PARAM_REQUIRED } from "./constants";
import { getUnProxyTarget, LazyRef } from "./decorators";
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
  constructor(target: any, targetKey?: string, parameterIndex?: number, type?: any) {

    const className = typeof target == 'string' ? target : getClassName(target);

    const methodOrProperty = targetKey;

    let parts = [];


    if (isClass(getUnProxyTarget(target))) {
      parts.push("static");
    }

    if (parameterIndex != undefined) {
      if (targetKey !== undefined) {
        parts.push(`${className}.${methodOrProperty}(${parameterIndex})`);
      } else {
        parts.push(`${className}.constructor(${parameterIndex})`);
      }
    } else {
      parts.push(`${className}.${methodOrProperty}`);
      parts = ["property"].concat(parts);
    }
    if (type != undefined) {
      if (type instanceof LazyRef) {
        type = type.getRef();
      }
      if (typeof type == 'string') {
        parts.push(`type[${type}]`);
      } else if (isClass(type)) {
        parts.push(`type[${getClassName(type)}]`);
      }
    }

    const callExpr = parts.join(" ");


    super(`${callExpr} inject failed, ${MSG_ERR_PARAM_REQUIRED}`);

    errorLogger(this.message);

  }

}

export class ResourceBusyError extends BaseError {

}