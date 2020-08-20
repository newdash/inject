import { isFunction } from '@newdash/newdash/isFunction';
import isUndefined from '@newdash/newdash/isUndefined';
import sortBy from '@newdash/newdash/sortBy';
import { WRAPPED_OBJECT_INDICATOR, WRAPPED_ORIGINAL_OBJECT_PROPERTY } from './constants';
import { InstanceProvider } from './provider';
import { Class, InjectWrappedInstance } from './utils';

const KEY_INJECT = 'inject:key_inject';
const KEY_INJECT_CLASS = 'inject:key_inject_class';
const KEY_INJECT_PARAMS = 'inject:method_inject_params';
const KEY_TRANSIENT = 'inject:class:transient';

const KEY_PROVIDE = 'inject:provide';
const KEY_PROVIDE_TRANSIENT = 'inject:provide:transient';

const KEY_DISABLE_PROXY = 'inject:proxy:disable';


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
    if (target[WRAPPED_OBJECT_INDICATOR] == true) {
      return getUnProxyTarget(target[WRAPPED_ORIGINAL_OBJECT_PROPERTY]);
    }
  }
  return target;
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
 * transient type, not singleton, do not cache it
 *
 * @param target
 */
export function transientClass(target) {
  Reflect.defineMetadata(KEY_TRANSIENT, true, target);
}

export function isTransientClass(target) {
  target = getUnProxyTarget(target);
  if (typeof target == 'function') {
    return Boolean(Reflect.getOwnMetadata(KEY_TRANSIENT, target));
  }
  return false;
}

export function setClassInjectInformation(target, info) {
  Reflect.defineMetadata(KEY_INJECT_CLASS, info, target);
}

export function getClassConstructorParams(target): InjectParameter[] {
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

export function provider(type?: LazyRef, transient?: boolean): (target, targetKey?) => void
export function provider(type?: any, transient?: boolean): (target, targetKey?) => void
export function provider(type?: any, transient = false) {
  return function (target, targetKey?) {
    Reflect.defineMetadata(KEY_PROVIDE, type, target, targetKey);
    Reflect.defineMetadata(KEY_PROVIDE_TRANSIENT, transient, target, targetKey);
  };
}

export function getTransientInfo(target: any, targetKey: any) {
  return Boolean(Reflect.getMetadata(KEY_PROVIDE_TRANSIENT, target, targetKey));
}

export function getProvideInfo(target: any, targetKey?: any) {
  return Reflect.getMetadata(KEY_PROVIDE, target, targetKey);
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


