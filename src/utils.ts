
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
    return true;
  }
  return false;
}

export function getClassName(typeOrInstance: any): string {
  if (typeOrInstance?.constructor == Function) {
    return typeOrInstance.name;
  }
  if (typeOrInstance?.constructor?.constructor == Function) {
    return typeOrInstance.constructor.name;
  }
  return undefined;
}

export function isClassDecorator(target: any, targetKey?: any, parameterIndex?: any) {
  return isClass(target) && targetKey == undefined && parameterIndex == undefined;
}

export function isClassConstructorParameterDecorator(target, targetKey, parameterIndex) {
  return isClass(target) && targetKey == undefined && typeof parameterIndex != undefined;
}

export function isClassMethodDecorator(target, targetKey, desc) {
  return target !== undefined && targetKey !== undefined && typeof desc == 'object';
}

export function isClassMethodParameterDecorator(target, targetKey, parameterIndex) {
  return target !== undefined && targetKey !== undefined && typeof parameterIndex == 'number';
}

export function isClassPropertyDecorator(target, targetKey, parameterIndex) {
  return target !== undefined && targetKey !== undefined && parameterIndex == undefined;
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
