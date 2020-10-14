import { isClass } from "@newdash/newdash/isClass";
import { UnwrapPromise } from "@newdash/newdash/types";
import { S_TYPE_FUNCTION, S_TYPE_NUMBER, S_TYPE_OBJECT } from "./constants";

export function getOrDefault(map: Map<any, any>, key, value) {
  if (!map.has(key)) {
    map.set(key, value);
  }
  return map.get(key);
}

export function typeToString(type: any) {
  if (typeof type === S_TYPE_OBJECT || typeof type === S_TYPE_FUNCTION) {
    return getClassName(type);
  }
  return type;
}

/**
 * get class name from type or instance
 * 
 * @param typeOrInstance 
 */
export function getClassName(typeOrInstance: any): string {
  if (isClass(typeOrInstance)) {
    return typeOrInstance.name;
  }
  if (isClass(typeOrInstance?.constructor)) {
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
  return isClass(target) && targetKey != undefined && typeof parameterIndex === 'number';
}

export function isClassStaticMethodDecorator(target, targetKey, parameterIndex) {
  return isClass(target) && targetKey != undefined && typeof parameterIndex === S_TYPE_OBJECT;
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
  return target !== undefined && !isClass(target) && targetKey !== undefined && typeof desc === S_TYPE_OBJECT;
}

/**
 * is class method parameter decorator
 * 
 * @param target 
 * @param targetKey 
 * @param parameterIndex 
 */
export function isClassMethodParameterDecorator(target, targetKey, parameterIndex) {
  return target !== undefined && !isClass(target) && targetKey !== undefined && typeof parameterIndex === S_TYPE_NUMBER;
}

/**
 * is class property decorator
 * 
 * @param target 
 * @param targetKey 
 * @param parameterIndex 
 */
export function isClassPropertyDecorator(target, targetKey, parameterIndex) {
  return target !== undefined && !isClass(target) && targetKey !== undefined && parameterIndex === undefined;
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
  [K in keyof T]: T[K] extends (...args: any) => any ? (...args: OptionalParameters<T[K]>) => Promise<UnwrapPromise<ReturnType<T[K]>>> : T[K]
}
