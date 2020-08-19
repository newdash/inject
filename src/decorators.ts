import isUndefined from '@newdash/newdash/isUndefined';
import sortBy from '@newdash/newdash/sortBy';
import { WRAPPED_OBJECT_INDICATOR, WRAPPED_ORIGINAL_OBJECT_PROPERTY } from './constants';


const KEY_INJECT = 'inject:key_inject';
const KEY_INJECT_CLASS = 'inject:key_inject_class';
const KEY_INJECT_PARAMS = 'inject:method_inject_params';
const KEY_TRANSIENT = 'inject:transient';

export interface InjectInformation {
  injectType: 'classProperty' | 'classMethod'
  parameters?: InjectParameter[]
  type?: any;
}

export interface InjectParameter {
  type: any;
  parameterIndex: number;
}

export function getUnProxyClass(target) {
  if (target[WRAPPED_OBJECT_INDICATOR] == true) {
    return getUnProxyClass(target[WRAPPED_ORIGINAL_OBJECT_PROPERTY]);
  }
  return target;
}

export function getClassInjectionInformation(target): Map<string, InjectInformation> {
  target = getUnProxyClass(target);
  if (target.prototype) {
    return Reflect.getMetadata(KEY_INJECT_CLASS, target.prototype) || new Map<string, InjectInformation>();
  }
  return Reflect.getMetadata(KEY_INJECT_CLASS, target) || new Map<string, InjectInformation>();
}

/**
 * transient type, not singleton, do not cache it
 *
 * @param target
 */
export function transient(target) {
  Reflect.defineMetadata(KEY_TRANSIENT, true, target);
}

export function isTransient(target) {
  target = getUnProxyClass(target);
  return Boolean(Reflect.getOwnMetadata(KEY_TRANSIENT, target));
}

export function setClassInjectInformation(target, info) {
  Reflect.defineMetadata(KEY_INJECT_CLASS, info, target);
}

export function getClassConstructorParams(target): InjectParameter[] {
  target = getUnProxyClass(target);
  return Reflect.getMetadata(KEY_INJECT_PARAMS, target) || [];
}

export function getClassMethodParams(target, targetKey): InjectParameter[] {
  target = getUnProxyClass(target);
  if (target.prototype) {
    return Reflect.getMetadata(KEY_INJECT_PARAMS, target.prototype, targetKey) || [];
  }
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


