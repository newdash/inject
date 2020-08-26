import { WRAPPED_OBJECT_CONTAINER_PROPERTY, WRAPPED_OBJECT_INDICATOR, WRAPPED_OBJECT_METHOD_INJECT_INFO, WRAPPED_ORIGINAL_OBJECT_PROPERTY } from "./constants";
import { InjectContainer } from "./container";
import { getClassMethodParams, getPropertyInjectedType, isNoWrap, isTransient } from "./decorators";
import { DefaultClassProvider } from "./provider";

/**
 * create wrapper (proxy) for object with inject container 
 * 
 * @param instance 
 * @param ic 
 */
export function createWrapper(instance: any, ic: InjectContainer) {

  if (instance == null || instance == undefined) {
    return instance;
  }

  if (['number', 'boolean', 'string', 'symbol', 'bigint'].includes(typeof instance)) {
    return instance;
  }

  if (typeof instance == 'object' || typeof instance == 'function') {

    // do NOT proxy inject container
    if (instance instanceof InjectContainer) {
      return instance;
    }

    // do NOT proxy promise object
    if (instance instanceof Promise) {
      return instance;
    }

    const containerId = ic.getFormattedId();

    // if the object has been wrapped by provided container
    if (instance[WRAPPED_OBJECT_CONTAINER_PROPERTY] == containerId) {
      return instance;
    }


    const handler: ProxyHandler<any> = {

      get: (target, property) => {

        if (isNoWrap(target, property as string)) {
          return target[property];
        }

        if (['constructor', 'prototype'].includes(property as string)) {
          return target[property];
        }

        // do NOT proxy if the injected has been indicated DO NOT WRAP
        const injectType = getPropertyInjectedType(target, property);
        // @ts-ignore
        if (injectType != undefined && !ic.canWrap(injectType)) {
          return target[property];
        }

        if (property in target) {
          const methodOrProperty = target[property];
          if (typeof methodOrProperty == 'function') {
            const proxyMethod = (...args: any[]) => ic.injectExecute(target, methodOrProperty, ...args);
            // overwrite function name
            Object.defineProperty(proxyMethod, "name", {
              value: `${property.toString()}_wrapped_by_container(${ic.getFormattedId()})`,
              writable: false
            });
            proxyMethod[WRAPPED_OBJECT_METHOD_INJECT_INFO] = getClassMethodParams(target, property);
            return proxyMethod;
          }
          return methodOrProperty;
        }

        if (property == WRAPPED_OBJECT_CONTAINER_PROPERTY) {
          return containerId;
        }

        if (property == WRAPPED_ORIGINAL_OBJECT_PROPERTY) {
          return instance;
        }

        if (property == WRAPPED_OBJECT_INDICATOR) {
          return true;
        }

        // if the property is not existed on object, return undefined
        return undefined;

      }

    };

    // for class, support proxy constructor
    if (instance?.constructor == Function) {

      handler.construct = async (target, args) => {
        const provider = new DefaultClassProvider(
          target,
          isTransient(target),
          await ic.createSubContainer()
        );
        return provider.provide(...args);
      };

    }

    return new Proxy(instance, handler);

  }

  return instance;
}
