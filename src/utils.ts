
export function getOrDefault(map: Map<any, any>, key, value) {
  if (!map.has(key)) {
    map.set(key, value);
  }
  return map.get(key);
}

export type Class = new (...args: any[]) => any

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
