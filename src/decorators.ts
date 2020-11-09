import { isClass } from '@newdash/newdash/isClass';
import { isFunction } from '@newdash/newdash/isFunction';
import { isUndefined } from '@newdash/newdash/isUndefined';
import { S_TYPE_FUNCTION, S_TYPE_NUMBER, S_TYPE_OBJECT, WRAPPED_OBJECT_INDICATOR, WRAPPED_OBJECT_METHOD_ORIGINAL_METHOD, WRAPPED_ORIGINAL_OBJECT_PROPERTY } from './constants';
import { createLogger } from './logger';
import { InstanceProvider } from './provider';
import { Class, InjectWrappedInstance, isClassConstructorParameterDecorator, isClassDecorator, isClassMethodDecorator, isClassMethodParameterDecorator, isClassPropertyDecorator, isClassStaticMethodDecorator, isClassStaticMethodParametersDecorator, isClassStaticPropertyDecorator } from './utils';

const KEY_INJECT = 'inject:key_inject';
const KEY_INJECT_CLASS = 'inject:key_inject_class';
const KEY_INJECT_PARAMETERS = 'inject:method_inject_parameters';
const KEY_TRANSIENT = 'inject:class:transient';

const KEY_INJECT_META_PARAM = 'inject:meta:provide_param';

const KEY_NO_WRAP = 'inject:no_wrap';

const KEY_PARAMETER_NO_WRAP = 'inject:parameter:no_wrap';

const KEY_REQUIRED = 'inject:required_parameter';

const KEY_NAMESPACE = "inject:namespace";

const KEY_PROVIDE = 'inject:provide';

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
    if (isWrappedFunction(target)) {
      return getUnProxyTarget(target[WRAPPED_OBJECT_METHOD_ORIGINAL_METHOD]);
    }
  }
  return target;
}

export function isWrappedObject(target: any): target is { [WRAPPED_ORIGINAL_OBJECT_PROPERTY]: any } {
  if (target !== undefined) {
    return Boolean(target[WRAPPED_OBJECT_INDICATOR]);
  }
  return false;
}

export function isWrappedFunction(target: any): target is { [WRAPPED_OBJECT_METHOD_ORIGINAL_METHOD]: any } {
  if (target !== undefined) {
    return Boolean(target[WRAPPED_OBJECT_METHOD_ORIGINAL_METHOD]);
  }
  return false;
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
export function transient(target: Class): void;
/**
 * transient type, inject container will not cache it
 * 
 * @param target 
 * @param targetKey 
 */
export function transient(target: any, targetKey: any): void;
export function transient(target, targetKey?) {
  Reflect.defineMetadata(KEY_TRANSIENT, true, target, targetKey);
}

export function isTransient(target, targetKey?) {
  target = getUnProxyTarget(target);
  if (targetKey != undefined) {
    // for instance, must use prototype
    return Boolean(Reflect.getMetadata(KEY_TRANSIENT, target, targetKey));
  } else if (isClass(target)) {
    return Boolean(Reflect.getOwnMetadata(KEY_TRANSIENT, target));
  }
  return false;
}

export function required(target, targetKey)
export function required(target, targetKey, parameterIndex)
export function required(target, targetKey, parameterIndex?) {
  if (typeof parameterIndex === S_TYPE_NUMBER) {
    Reflect.defineMetadata(KEY_REQUIRED, true, target, `${targetKey}_param_${parameterIndex}`);
  } else {
    Reflect.defineMetadata(KEY_REQUIRED, true, target, targetKey);
  }
}

export function isRequired(target, targetKey, parameterIndex?) {
  if (typeof parameterIndex === S_TYPE_NUMBER) {
    return Boolean(Reflect.getMetadata(KEY_REQUIRED, target, `${targetKey}_param_${parameterIndex}`));
  }
  return Boolean(Reflect.getMetadata(KEY_REQUIRED, target, targetKey));
}


/**
 * disable wrapper for provider type/class instance
 * 
 * @param target 
 * @param targetKey 
 */
export function noWrap(target: any, targetKey?: any, parameterIndex?: any) {
  if (
    isClassMethodParameterDecorator(target, targetKey, parameterIndex) ||
    isClassConstructorParameterDecorator(target, targetKey, parameterIndex)
  ) {
    const parametersNoWrap = Reflect.getMetadata(KEY_PARAMETER_NO_WRAP, target, targetKey) || [];
    parametersNoWrap[parameterIndex] = true;
    Reflect.defineMetadata(KEY_PARAMETER_NO_WRAP, parametersNoWrap, target, targetKey);
  } else {
    Reflect.defineMetadata(KEY_NO_WRAP, true, target, targetKey);
  }
}

/**
 * check provider require not wrap the instance 
 * 
 * @param provider 
 */
export function isNoWrapProvider(provider: any): boolean {
  if (isProviderInstance(provider)) {
    return isNoWrap(provider, "provide");
  }
  else if (isProviderType(provider)) {
    return isNoWrap(provider.prototype, "provide");
  }
  return false;
}

/**
 * class is decorated with @noWrap
 * @param classType 
 */
export function isNoWrap(classType: any): boolean
/**
 * class property is decorated with @noWrap
 * @param target 
 * @param propertyName 
 */
export function isNoWrap(target: any, propertyName: string): boolean
/**
 * class method parameter is decorated with @noWrap
 * @param target 
 * @param methodName 
 * @param parameterIndex 
 */
export function isNoWrap(target: any, methodName: any, parameterIndex: number): boolean
export function isNoWrap(target: any, targetKey?: any, parameterIndex?: any) {
  if (
    isClassMethodParameterDecorator(target, targetKey, parameterIndex) ||
    isClassConstructorParameterDecorator(target, targetKey, parameterIndex)
  ) {
    return Boolean(
      (Reflect.getMetadata(KEY_PARAMETER_NO_WRAP, target, targetKey) || [])[parameterIndex]
    );
  }
  if (typeof target === S_TYPE_OBJECT || typeof target === S_TYPE_FUNCTION) {
    return Boolean(Reflect.getMetadata(KEY_NO_WRAP, target, targetKey));
  }
  return false;
}

export function namespace(nSpace: string) {
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
  const defaultItems = isClass(target) ? new Array(target.length).fill(undefined) : [];
  return (Reflect.getMetadata(KEY_INJECT_PARAMETERS, target) || defaultItems);
}

export function setClassConstructorParams(target: Class, parameters: InjectParameter[]) {
  Reflect.defineMetadata(KEY_INJECT_PARAMETERS, parameters, target);
}

export function getClassMethodParams(target, targetKey): InjectParameter[] {
  target = getUnProxyTarget(target);
  return (Reflect.getMetadata(KEY_INJECT_PARAMETERS, target, targetKey) || []);
}

export function setClassMethodParameter(target: any, targetKey: any, param: InjectParameter) {
  const params = getClassMethodParams(target, targetKey);
  params[param.parameterIndex] = {
    ...params[param.parameterIndex],
    ...param
  };
  Reflect.defineMetadata(KEY_INJECT_PARAMETERS, params, target, targetKey);
}

export function setClassMethodParams(target: any, targetKey: any, params: InjectParameter[]) {
  Reflect.defineMetadata(KEY_INJECT_PARAMETERS, params, target, targetKey);
}

export class LazyRef<T = any> {

  _ref: () => T;

  constructor(ref) {
    this._ref = ref;
  }

  getRef() {
    return this._ref();
  }

  /**
   * @deprecated please use `lazyRef` function to create new instance
   * @param type 
   */
  static create<T>(type: () => T) {
    return new LazyRef<T>(type);
  }

}

/**
 * @alias LazyRef.create
 * @param type 
 */
export function lazyRef<T>(type: () => T) {
  return LazyRef.create<T>(type);
}

/**
 * check object is a provider class
 * 
 * @param target 
 */
export function isProviderType(target: any): target is Class<InstanceProvider> {
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

/**
 * check provider is a provider instance
 * 
 * @param target 
 */
export function isProviderInstance(target: any): target is InstanceProvider {
  target = getUnProxyTarget(target);
  const typeInfo = getProvideInfo(target, "provide") || target.type;
  if (!isUndefined(typeInfo)) {
    if (isFunction(target?.provide)) {
      return true;
    }
  }
  return false;
}

/**
 * provide instance for lazy ref
 * 
 * @param type 
 */
export function provider(type?: LazyRef): MethodDecorator
/**
 * provide instance for key
 * @param type 
 */
export function provider(type?: string): MethodDecorator
/**
 * provide instance for class
 * 
 * @param type 
 */
export function provider(type?: Class): MethodDecorator
export function provider(type?: any): MethodDecorator {
  return function (target, targetKey?) {
    Reflect.defineMetadata(KEY_PROVIDE, type, target, targetKey);
  };
}

/**
 * alias of @provider decorator
 */
export const withType = provider;
/**
 * combine @withType & @noWrap
 * 
 * @param type 
 */
export function withNoWrapType(type: LazyRef): MethodDecorator
/**
 * combine @withType & @noWrap
 * 
 * @param type 
 */
export function withNoWrapType(type: Class): MethodDecorator
/**
 * combine @withType & @noWrap
 * 
 * @param type 
 */
export function withNoWrapType(type: string): MethodDecorator
export function withNoWrapType(type: any): MethodDecorator {
  return function (target, targetKey, desc) {
    provider(type)(target, targetKey, desc);
    noWrap(target, targetKey);
  };
};

/**
 * get transient information
 * 
 * @param target 
 * @param targetKey 
 */
export function getTransientInfo(target: any, targetKey: any) {
  target = getUnProxyTarget(target);
  return isTransient(target, targetKey);
}


/**
 * get provide type information
 */
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
 * 
 * @param type 
 */
export function createInjectDecorator(type?: LazyRef, noWrap?: boolean): ParameterDecorator & PropertyDecorator;
export function createInjectDecorator(type: any, noWrap?: boolean): ParameterDecorator & PropertyDecorator;
export function createInjectDecorator(type: any, noWrap = false) {
  if (isProviderType(type)) {
    const provideType = getProvideInfo(type.prototype, "provide");
    decoratorLogger('%o is a provider class, will use the provided type %o to create decorator', type, provideType);
    return createInjectDecorator(provideType);
  }
  return function (target: any, targetKey: any, parameterIndex?: any) {
    if (noWrap) {
      return nInject(type)(target, targetKey, parameterIndex);
    }
    return inject(type)(target, targetKey, parameterIndex);
  };
}

/**
 * inject parameter without wrapper
 *
 * @param type
 */
export function nInject(type: LazyRef): ParameterDecorator & PropertyDecorator;
export function nInject(type: Class): ParameterDecorator & PropertyDecorator;
export function nInject(type: string): ParameterDecorator & PropertyDecorator;
export function nInject(): PropertyDecorator;
export function nInject(type?: any) {
  return function (target, targetKey?, parameterIndex?) {
    inject(type)(target, targetKey, parameterIndex);
    noWrap(target, targetKey, parameterIndex);
  };
}

/**
 * inject parameter with wrapper
 *
 * @param type
 */
export function inject(type: LazyRef): ParameterDecorator & PropertyDecorator;
export function inject(type: Class): ParameterDecorator & PropertyDecorator;
export function inject(type: string): ParameterDecorator & PropertyDecorator;
export function inject(): PropertyDecorator;
export function inject(type?: any) {

  return function (target, targetKey?, parameterIndex?) {

    const classInjectMeta = getClassInjectionInformation(target);

    if (!isUndefined(targetKey)) {

      const reflectType = Reflect.getMetadata('design:type', target, targetKey);

      if (typeof parameterIndex == 'number') {

        const param: InjectParameter = { type, parameterIndex };

        // inject type into class method parameter
        const params = Reflect.getMetadata(KEY_INJECT_PARAMETERS, target, targetKey) || [];

        params[parameterIndex] = param;

        setClassMethodParams(target, targetKey, params);

        classInjectMeta.set(targetKey, { injectType: 'classMethod', parameters: params });

      } else {

        // reflect type from framework
        // inject type into class property
        Reflect.defineMetadata(KEY_INJECT, type || reflectType, target, targetKey);

        classInjectMeta.set(targetKey, { injectType: 'classProperty', type: type || reflectType });

      }

    } else if (!isUndefined(target) && !isUndefined(parameterIndex) && isUndefined(targetKey)) {
      // constructor
      const params = getClassConstructorParams(target);
      params[parameterIndex] = { type, parameterIndex };
      setClassConstructorParams(target, params);
    }

    if (classInjectMeta.size > 0) {
      setClassInjectInformation(target, classInjectMeta);
    }

  };

}

function getInjectParameter(target: any, targetKey?: any, parameterIndexOrDesc?: any) {

  target = getUnProxyTarget(target);

  const defaultValue = {};

  if (isClassDecorator(target, targetKey, parameterIndexOrDesc)) {
    const rt = [];
    const constructorParamLength = target.length || 0;
    for (let idx = 0; idx < constructorParamLength; idx++) {
      rt.push(getInjectParameter(target, targetKey, idx));
    }
    return rt;
  }
  else if (isClassConstructorParameterDecorator(target, targetKey, parameterIndexOrDesc)) {
    // constructor parameter
    return Reflect.getOwnMetadata(KEY_INJECT_META_PARAM, target, `__constructor__param__${parameterIndexOrDesc}`) || defaultValue;
  }
  else if (isClassStaticMethodParametersDecorator(target, targetKey, parameterIndexOrDesc)) {
    return Reflect.getMetadata(KEY_INJECT_META_PARAM, target,
      `__static__${targetKey}__method__param__${parameterIndexOrDesc}`
    ) || defaultValue;
  }
  else if (isClassStaticPropertyDecorator(target, targetKey, parameterIndexOrDesc)) {
    return Reflect.getOwnMetadata(KEY_INJECT_META_PARAM, target, targetKey) || defaultValue;
  }
  else if (isClassStaticMethodDecorator(target, targetKey, parameterIndexOrDesc)) {
    const rt = [];
    const paramLength = target[targetKey].length || 0;
    for (let idx = 0; idx < paramLength; idx++) {
      rt.push(getInjectParameter(target, targetKey, idx));
    }
    return rt;
  }
  else if (isClassMethodParameterDecorator(target, targetKey, parameterIndexOrDesc)) {
    return Reflect.getMetadata(
      KEY_INJECT_META_PARAM,
      target,
      `${targetKey}__method__param__${parameterIndexOrDesc}`
    ) || defaultValue;
  }
  else if (isClassPropertyDecorator(target, targetKey, parameterIndexOrDesc)) {
    return Reflect.getMetadata(KEY_INJECT_META_PARAM, target, targetKey) || defaultValue;
  }
  else if (isClassMethodDecorator(target, targetKey, parameterIndexOrDesc)) {
    const rt = [];
    const methodParamLength = target[targetKey].length || 0;
    for (let idx = 0; idx < methodParamLength; idx++) {
      rt.push(getInjectParameter(target, targetKey, idx));
    }
    return rt;
  }


  return defaultValue;

}

/**
 * provide param (name: value) to provider
 * 
 * @param key 
 * @param value 
 */
function param(key: string, value: any) {
  return function (target: any, targetKey: any, parameterIndex?: number) {
    if (isClassConstructorParameterDecorator(target, targetKey, parameterIndex)) {
      // constructor parameter
      const paramsMeta = getInjectParameter(target, targetKey, parameterIndex);
      paramsMeta[key] = value;
      Reflect.defineMetadata(KEY_INJECT_META_PARAM, paramsMeta, target, `__constructor__param__${parameterIndex}`);
    }
    else if (isClassStaticMethodParametersDecorator(target, targetKey, parameterIndex)) {
      const paramsMeta = getInjectParameter(target, targetKey, parameterIndex);
      paramsMeta[key] = value;
      Reflect.defineMetadata(KEY_INJECT_META_PARAM, paramsMeta, target, `__static__${targetKey}__method__param__${parameterIndex}`);
    }
    else if (isClassStaticPropertyDecorator(target, targetKey, parameterIndex)) {
      const paramsMeta = getInjectParameter(target, targetKey, parameterIndex);
      paramsMeta[key] = value;
      Reflect.defineMetadata(KEY_INJECT_META_PARAM, paramsMeta, target, targetKey);
    }
    else if (isClassMethodParameterDecorator(target, targetKey, parameterIndex)) {
      // class method parameter
      const paramsMeta = getInjectParameter(target, targetKey, parameterIndex);
      paramsMeta[key] = value;
      // constructor parameter
      Reflect.defineMetadata(KEY_INJECT_META_PARAM, paramsMeta, target, `${targetKey}__method__param__${parameterIndex}`);
    }
    else if (isClassPropertyDecorator(target, targetKey, parameterIndex)) {
      // class property
      const paramsMeta = getInjectParameter(target, targetKey, parameterIndex);
      paramsMeta[key] = value;
      Reflect.defineMetadata(KEY_INJECT_META_PARAM, paramsMeta, target, targetKey);
    }

  };
}

inject.param = param;

inject.getInjectParameter = getInjectParameter;