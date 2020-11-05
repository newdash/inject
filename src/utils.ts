import { isClass } from "@newdash/newdash/isClass";
import { isPlainObject } from "@newdash/newdash/isPlainObject";
import { UnwrapPromise } from "@newdash/newdash/types";
import { upperFirst } from "@newdash/newdash/upperFirst";
import { S_TYPE_NUMBER, S_TYPE_OBJECT } from "./constants";
import { getUnProxyTarget, LazyRef } from "./decorators";




export function getOrDefault(map: Map<any, any>, key, value) {
  if (!map.has(key)) {
    map.set(key, value);
  }
  return map.get(key);
}

export function typeToString(type: any): string {
  if (type instanceof LazyRef) {
    type = type.getRef();
  }
  return valueToString(type);
}

export function valueToString(value: any): string {

  value = getUnProxyTarget(value);

  const valueType = typeof value;

  if (valueType === 'undefined') {
    return '[Undefined]';
  }
  if (value === null) {
    return '[Null]';
  }
  if (valueType === 'number') {
    return `[Number '${value}']`;
  }

  if (valueType === 'string') {
    return `[String '${value}']`;
  }

  if (valueType === 'symbol') {
    return `[Symbol '${value.toString()}']`;
  }

  if (valueType === 'bigint') {
    return `[BigInt '${value.toString()}']`;
  }

  if (isPlainObject(value)) {
    return `[Object with properties [${Object.getOwnPropertyNames(value).join(", ")}]]`;
  }

  if (isClass(value)) {
    return `[Class '${getClassName(value)}']`;
  }

  if (valueType === 'function') {
    return `[Function '${value.name || 'UnknownFunc'}' with ${value.length} arguments]`;
  }

  if (value.toString && typeof value.toString === 'function') {
    return `[${upperFirst(valueType)} '${value.toString()}']`;
  }

  return `[Unknown ${valueType}]`;

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
