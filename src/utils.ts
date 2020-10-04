
export function getOrDefault(map: Map<any, any>, key, value) {
  if (!map.has(key)) {
    map.set(key, value);
  }
  return map.get(key);
}

/**
 * check given value is Class object
 * 
 * @param obj 
 */
export function isClass(obj: any): obj is Class {
  if (obj?.constructor === Function) {
    if (/^class [\s\S]*?$/.test(obj.toString())) {
      return true;
    }
  }
  return false;
}

/**
 * get class name from type or instance
 * 
 * @param typeOrInstance 
 */
export function getClassName(typeOrInstance: any): string {
  if (typeOrInstance?.constructor == Function) {
    return typeOrInstance.name;
  }
  if (typeOrInstance?.constructor?.constructor == Function) {
    return typeOrInstance.constructor.name;
  }
  return undefined;
}

/**
 * is class decorator
 * 
 * @param target 
 * @param targetKey 
 * @param parameterIndex 
 */
export function isClassDecorator(target: any, targetKey?: any, parameterIndex?: any) {
  return isClass(target) && targetKey == undefined && parameterIndex == undefined;
}

/**
 * is class static method parameter decorator
 * 
 * @param target 
 * @param targetKey 
 * @param parameterIndex 
 */
export function isClassStaticMethodParametersDecorator(target, targetKey, parameterIndex) {
  return isClass(target) && targetKey != undefined && typeof parameterIndex == 'number';
}

export function isClassStaticMethodDecorator(target, targetKey, parameterIndex) {
  return isClass(target) && targetKey != undefined && typeof parameterIndex == 'object';
}

export function isClassStaticPropertyDecorator(target, targetKey, parameterIndex) {
  return isClass(target) && targetKey != undefined && parameterIndex == undefined;
}

/**
 * is class constructor parameter decorator
 * 
 * @param target 
 * @param targetKey 
 * @param parameterIndex 
 */
export function isClassConstructorParameterDecorator(target, targetKey, parameterIndex) {
  return isClass(target) && targetKey == undefined && typeof parameterIndex != undefined;
}

/**
 * is class method decorator
 * 
 * @param target 
 * @param targetKey 
 * @param desc 
 */
export function isClassMethodDecorator(target, targetKey, desc) {
  return target !== undefined && !isClass(target) && targetKey !== undefined && typeof desc == 'object';
}

/**
 * is class method parameter decorator
 * 
 * @param target 
 * @param targetKey 
 * @param parameterIndex 
 */
export function isClassMethodParameterDecorator(target, targetKey, parameterIndex) {
  return target !== undefined && !isClass(target) && targetKey !== undefined && typeof parameterIndex == 'number';
}

/**
 * is class property decorator
 * 
 * @param target 
 * @param targetKey 
 * @param parameterIndex 
 */
export function isClassPropertyDecorator(target, targetKey, parameterIndex) {
  return target !== undefined && !isClass(target) && targetKey !== undefined && parameterIndex == undefined;
}

export type Class<T = any> = new (...args: any[]) => T

/**
 * optional version of Parameters
 */
export type OptionalParameters<T extends Function> = T extends (...args: infer P) => any ? { [K in keyof P]?: P[K] } : never;

export type OptionalConstructorParameters<T extends Function> = T extends new (...args: infer P) => any ? { [K in keyof P]?: P[K] } : never;


export type PromiseConstructor<T extends Class> = new (...args: OptionalConstructorParameters<T>) => Promise<InstanceType<T>>

export interface InjectWrappedClassConstructor<T extends Class> {
  new(...args: OptionalConstructorParameters<T>): Promise<InjectWrappedInstance<InstanceType<T>>>
}

export type InjectWrappedClassType<T extends Class> = InjectWrappedInstance<T> & InjectWrappedClassConstructor<T>

export type InjectWrappedInstance<T> = {
  [K in keyof T]: T[K] extends (...args: any) => any ? (...args: OptionalParameters<T[K]>) => Promise<ReturnType<T[K]>> : T[K]
}
