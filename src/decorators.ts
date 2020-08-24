import { isFunction } from '@newdash/newdash/isFunction';
import isUndefined from '@newdash/newdash/isUndefined';
import sortBy from '@newdash/newdash/sortBy';
import { WRAPPED_OBJECT_INDICATOR, WRAPPED_ORIGINAL_OBJECT_PROPERTY } from './constants';
import { createLogger } from './logger';
import { InstanceProvider } from './provider';
import { Class, InjectWrappedInstance } from './utils';

const KEY_INJECT = 'inject:key_inject';
const KEY_INJECT_CLASS = 'inject:key_inject_class';
const KEY_INJECT_PARAMS = 'inject:method_inject_params';
const KEY_TRANSIENT = 'inject:class:transient';

const KEY_REQUIRED = 'inject:required_parameter';

const KEY_NAMESPACE = "inject:namespace";

const KEY_PROVIDE = 'inject:provide';

const KEY_DISABLE_PROXY = 'inject:proxy:disable';

const decoratorLogger = createLogger("decorator");


export interface InjectInformation {
  injectType: 'classProperty' | 'classMethod'
  parameters?: InjectParameter[]
  type?: any;
}

export interface InjectParameter {
  type: any;
  parameterIndex: number;
}


/**
 * objects will wrapped by IoC Container, use this function get the original object
 * 
 * @param target 
 */
export function getUnProxyTarget<T extends Class>(target: InjectWrappedInstance<T>): T
export function getUnProxyTarget<T extends Class>(target: T): T
export function getUnProxyTarget(target: any) {
  if (target) {
    if (isWrappedObject(target)) {
      return getUnProxyTarget(target[WRAPPED_ORIGINAL_OBJECT_PROPERTY]);
    }
  }
  return target;
}

export function isWrappedObject(target: any): target is { [WRAPPED_ORIGINAL_OBJECT_PROPERTY]: any } {
  if (target != undefined) {
    return Boolean(target[WRAPPED_OBJECT_INDICATOR]);
  }
  return false;
}


/**
 * indicate the inject container DO NOT proxy this property/function
 * 
 * generally, some property has a function value, sometimes there will cause issue with proxy (with a new/wrong reference)
 * 
 * @param target 
 * @param propertyKey 
 * 
 */
export function disableProxy(target: any, propertyKey: string) {
  target = getUnProxyTarget(target);
  Reflect.defineMetadata(KEY_DISABLE_PROXY, true, target, propertyKey);
}

/**
 * check property is disabled for proxy
 * 
 * @param target 
 * @param propertyKey 
 */
export function isProxyDisabled(target: any, propertyKey: string): boolean {
  target = getUnProxyTarget(target);
  return Boolean(Reflect.getMetadata(KEY_DISABLE_PROXY, target, propertyKey));
}

export function getClassInjectionInformation(target): Map<string, InjectInformation> {
  target = getUnProxyTarget(target);
  return Reflect.getMetadata(KEY_INJECT_CLASS, target) || new Map<string, InjectInformation>();
}

/**
 * transient provider, inject container will not cache it
 *
 * @param target
 */
export function transient(target)
/**
 * transient type, inject container will not cache it
 * 
 * @param target 
 * @param targetKey 
 */
export function transient(target, targetKey)
export function transient(target, targetKey?) {
  Reflect.defineMetadata(KEY_TRANSIENT, true, target, targetKey);
}

export function isTransient(target, targetKey?) {
  target = getUnProxyTarget(target);
  if (targetKey != undefined) {
    // for instance, must use prototype
    return Boolean(Reflect.getMetadata(KEY_TRANSIENT, target, targetKey));
  }
  if (typeof target == 'function') {
    return Boolean(Reflect.getOwnMetadata(KEY_TRANSIENT, target));
  }
  return false;
}

export function required(target, targetKey)
export function required(target, targetKey, parameterIndex)
export function required(target, targetKey, parameterIndex?) {
  if (parameterIndex != undefined) {
    const m = Reflect.getMetadata(KEY_REQUIRED, target, targetKey) || [];
    m[parameterIndex] = true;
    Reflect.defineMetadata(KEY_REQUIRED, m, target, targetKey);
  } else {
    Reflect.defineMetadata(KEY_REQUIRED, true, target, targetKey);
  }
}

export function isRequired(target, targetKey, parameterIndex?) {
  if (parameterIndex != undefined) {
    const m = Reflect.getMetadata(KEY_REQUIRED, target, targetKey) || [];
    return Boolean(m[parameterIndex]);
  }
  return Boolean(Reflect.getMetadata(KEY_REQUIRED, target, targetKey));
}

export function namespace(nSpace) {
  return function (target: Class) {
    Reflect.defineMetadata(KEY_NAMESPACE, nSpace, target);
  };
}

/**
 * get namespace for class
 * 
 * @param target 
 */
export function getNamespace(target: Class): string
/**
 * get namespace for instance
 * 
 * @param target 
 */
export function getNamespace(target: any): string
export function getNamespace(target: any): string {
  if (target.constructor == Function) {
    return Reflect.getOwnMetadata(KEY_NAMESPACE, target) || "";
  }
  return Reflect.getOwnMetadata(KEY_NAMESPACE, target?.constructor) || "";
}

export function setClassInjectInformation(target, info) {
  Reflect.defineMetadata(KEY_INJECT_CLASS, info, target);
}

/**
 * get the parameters metadata of the constructor of class
 * 
 * @param target 
 */
export function getClassConstructorParams(target: Class): InjectParameter[] {
  target = getUnProxyTarget(target);
  return Reflect.getMetadata(KEY_INJECT_PARAMS, target) || [];
}

export function getClassMethodParams(target, targetKey): InjectParameter[] {
  target = getUnProxyTarget(target);
  return Reflect.getMetadata(KEY_INJECT_PARAMS, target, targetKey) || [];
}

export class LazyRef<T = any> {

  _ref: () => T;

  constructor(ref) {
    this._ref = ref;
  }

  getRef() {
    return this._ref();
  }

  static create<T>(type: () => T) {
    return new LazyRef<T>(type);
  }

}

export function isProviderType(target): target is Class<InstanceProvider> {
  target = getUnProxyTarget(target);
  if (target?.constructor == Function) {
    // own 'type' and 'provide' property
    const typeInfo = getProvideInfo(target.prototype, "provide");
    if (!isUndefined(typeInfo)) {
      if (isFunction(target?.prototype?.provide)) {
        return true;
      }
    }
  }
  return false;
}

export function isProviderInstance(target): target is InstanceProvider {
  target = getUnProxyTarget(target);
  const typeInfo = getProvideInfo(target, "provide") || target.type;
  if (!isUndefined(typeInfo)) {
    if (isFunction(target?.provide)) {
      return true;
    }
  }
  return false;
}

export function provider(type?: LazyRef): (target, targetKey?) => void
export function provider(type?: string): (target, targetKey?) => void
export function provider(type?: Class): (target, targetKey?) => void
export function provider(type?: any) {
  return function (target, targetKey?) {
    Reflect.defineMetadata(KEY_PROVIDE, type, target, targetKey);
  };
}

/**
 * alias of @provider decorator
 */
export const withType = provider;

export function getTransientInfo(target: any, targetKey: any) {
  return isTransient(target, targetKey);
}

export function getProvideInfo(target: any, targetKey?: any) {
  let rt = Reflect.getMetadata(KEY_PROVIDE, target, targetKey);
  if (rt instanceof LazyRef) {
    rt = rt.getRef();
  }
  return rt;
}

/**
 * get @inject type of the property of the class instance
 * 
 * @param target 
 * @param targetKey 
 */
export function getPropertyInjectedType(target, targetKey) {
  target = getUnProxyTarget(target);
  return Reflect.getMetadata(KEY_INJECT, target, targetKey);
}

/**
 * create a new decorator for inject specific type
 * @param type 
 */
export function createInjectDecorator(type?: LazyRef): (target, targetKey, parameterIndex?) => void;
export function createInjectDecorator(type: any): (target, targetKey, parameterIndex?) => void;
export function createInjectDecorator(type: any) {
  if (isProviderType(type)) {
    const provideType = getProvideInfo(type.prototype, "provide");
    decoratorLogger('%o is a provider class, will use the provided type %o to create decorator', type, provideType);
    return createInjectDecorator(provideType);
  }
  return function (target, targetKey, parameterIndex) {
    return inject(type)(target, targetKey, parameterIndex);
  };
}

/**
 * inject parameter
 *
 * @param type
 */
export function inject(type?: LazyRef): (target, targetKey, parameterIndex?) => void
export function inject(type?: any): (target, targetKey, parameterIndex?) => void
export function inject(type?: any) {

  return function (target, targetKey?, parameterIndex?) {

    const classInjections = getClassInjectionInformation(target);

    if (!isUndefined(targetKey)) {

      const reflectType = Reflect.getMetadata('design:type', target, targetKey);

      if (!isUndefined(parameterIndex)) {

        // inject type into class method parameter
        let params = Reflect.getMetadata(KEY_INJECT_PARAMS, target, targetKey) || [];
        params.push({ type, parameterIndex });

        params = sortBy(params, 'parameterIndex');
        Reflect.defineMetadata(KEY_INJECT_PARAMS, params, target, targetKey);
        classInjections.set(targetKey, { injectType: 'classMethod', parameters: params });

      } else {


        // reflect type from framework
        // inject type into class property
        Reflect.defineMetadata(KEY_INJECT, type || reflectType, target, targetKey);

        classInjections.set(targetKey, { injectType: 'classProperty', type: type || reflectType });

      }

    } else if (!isUndefined(target) && !isUndefined(parameterIndex) && isUndefined(targetKey)) {
      // constructor
      const params = Reflect.getMetadata(KEY_INJECT_PARAMS, target) || [];
      params.push({ type, parameterIndex });
      Reflect.defineMetadata(KEY_INJECT_PARAMS, params, target);

    }

    setClassInjectInformation(target, classInjections);

  };

}

