import { WRAPPED_OBJECT_CONTAINER_PROPERTY, WRAPPED_OBJECT_INDICATOR, WRAPPED_OBJECT_METHOD_CONTAINER, WRAPPED_OBJECT_METHOD_INJECT_INFO, WRAPPED_OBJECT_METHOD_ORIGINAL_METHOD, WRAPPED_ORIGINAL_OBJECT_PROPERTY } from "./constants";
import { InjectContainer } from "./container";
import { getClassMethodParams, getPropertyInjectedType, getUnProxyTarget, isNoWrap, isProviderInstance, isTransient } from "./decorators";
import { DefaultClassProvider } from "./provider";
import { isClass } from "./utils";

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

    // if the object has been wrapped by provided container
    if (instance[WRAPPED_OBJECT_CONTAINER_PROPERTY] == ic) {
      return instance;
    }

    const handler: ProxyHandler<any> = {

      get: (target, propertyName) => {

        if (propertyName in target) {
          // if property existed

          if (!(isProviderInstance(target) && propertyName === "provide")) {

            // if not the Provider.provide function
            if (isNoWrap(target, propertyName as string)) {
              return target[propertyName];
            }

            if (['constructor', 'prototype'].includes(propertyName as string)) {
              return target[propertyName];
            }

            // do NOT proxy if the injected has been indicated DO NOT WRAP
            const injectType = getPropertyInjectedType(target, propertyName);

            // @ts-ignore
            if (injectType != undefined && !ic.canWrap(injectType)) {
              return target[propertyName];
            }

          }

          const methodOrProperty = target[propertyName];

          if (typeof methodOrProperty == 'function') {

            const params = getClassMethodParams(target, propertyName);

            // only proxy function which parameters decorate with '@inject'
            if (params?.length > 0) {
              const proxyMethod = (...args: any[]) => ic.injectExecute(target, methodOrProperty, ...args);

              // overwrite function name
              Object.defineProperty(proxyMethod, "name", {
                value: propertyName,
                writable: false
              });

              proxyMethod[WRAPPED_OBJECT_METHOD_INJECT_INFO] = getClassMethodParams(target, propertyName);
              proxyMethod[WRAPPED_OBJECT_METHOD_CONTAINER] = ic;
              proxyMethod[WRAPPED_OBJECT_METHOD_ORIGINAL_METHOD] = methodOrProperty;

              return proxyMethod;
            }

          }

          if (typeof methodOrProperty == 'object') {
            return createWrapper(methodOrProperty, ic);
          }

          return methodOrProperty;
        }

        if (propertyName == WRAPPED_OBJECT_CONTAINER_PROPERTY) {
          return ic;
        }

        if (propertyName == WRAPPED_ORIGINAL_OBJECT_PROPERTY) {
          return instance;
        }

        if (propertyName == WRAPPED_OBJECT_INDICATOR) {
          return true;
        }

        // if the property is not existed on object, return undefined
        return undefined;

      }

    };

    // for class, support proxy constructor
    if (isClass(instance)) {

      handler.construct = async (target, args) => {
        target = getUnProxyTarget(target);
        const provider = new DefaultClassProvider(
          target,
          isTransient(target),
          await ic.createSubContainer()
        );
        const inst = await provider.provide(...args);
        // the proxies constructor will FORCE overwrite storage
        // with `new wrappedClass()`
        if (!isTransient(target)) {
          // @ts-ignore
          ic.setStore(target, inst);
        }
        return inst;
      };

    }

    return new Proxy(instance, handler);

  }

  return instance;
}
