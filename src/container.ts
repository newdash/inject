import { alg, Graph } from 'graphlib';
import { WRAPPED_OBJECT_INDICATOR, WRAPPED_ORIGINAL_OBJECT_PROPERTY } from './constants';
import { getClassConstructorParams, getClassInjectionInformation, getClassMethodParams, inject, InjectParameter, isTransient, LazyRef, transient } from './decorators';
import { createInstanceProvider, InstanceProvider } from './provider';
import { Class, getOrDefault, InjectWrappedInstance, OptionalParameters } from './utils';


/**
 * tmp inject context, store injection temp object in single construction
 */
export type InjectContext = Map<any, any>

/**
 * inject container
 */
export class InjectContainer {

  private _store: Map<any, any>

  protected _parent: InjectContainer;

  private _providers: Map<any, InstanceProvider>

  constructor() {
    this._providers = new Map();
    this._store = new Map();
  }

  public static New() {
    return new InjectContainer();
  }

  public getParent(): InjectContainer {
    return this._parent;
  }

  public registerProvider(provider: InstanceProvider) {
    this._providers.set(provider.type, provider);
  }

  public registerInstance(type: any, instance: any, transient: boolean = false) {
    this.registerProvider(createInstanceProvider(type, instance, transient));
  }

  public async createSubContainer(): Promise<InjectContainer> {
    // @ts-ignore
    return new SubLevelInjectContainer(this);
  }

  async getInstance<T extends Class>(type: LazyRef<T>, ctx?: Map<any, any>): Promise<InstanceType<T>>;
  async getInstance<T extends Class>(type: T, ctx?: Map<any, any>): Promise<InstanceType<T>>;
  async getInstance(type: any, ctx?: Map<any, any>): Promise<any>;
  async getInstance(type: any, ctx: Map<any, any>) {

    if (ctx == undefined) {
      ctx = new Map();
    }

    if (type instanceof LazyRef) {
      type = type.getRef();
    }

    // if target require inject the 'InjectContainer',
    // just inject a sub container,
    // and it will useful for many scenarios
    // :)
    if (type == InjectContainer || type == SubLevelInjectContainer) {
      return await this.createSubContainer();
    }

    // if class has cycle dependency in constructor, throw error
    this._checkDependency(type);

    // prefer use context
    if (ctx.has(type)) {
      return ctx.get(type);
    }

    let withStore = this._withStore.bind(this);
    let producer = undefined;

    // user define the provider
    if (this.hasInProviders(type)) {
      const provider = this.getProvider(type);
      if (Boolean(provider.transient) || (typeof provider.type == 'function' && isTransient(provider.type))) {
        withStore = this._withContext.bind(this);
      }
      producer = () => this.injectExecute(provider, provider.provide);
    }

    // use default provider for classes
    else if (typeof type == 'function') {
      if (isTransient(type)) {
        withStore = this._withContext.bind(this);
      }
      producer = () => this._defaultClassProvider(type, ctx);
    }

    if (producer) {
      return withStore(type, producer, ctx);
    }

    return undefined;
  }

  async getWrappedInstance<T extends Class>(type: LazyRef<T>, ctx?: Map<any, any>): Promise<InjectWrappedInstance<InstanceType<T>>>;
  async getWrappedInstance<T extends Class>(type: T, ctx?: Map<any, any>): Promise<InjectWrappedInstance<InstanceType<T>>>;
  async getWrappedInstance(type: any, ctx?: Map<any, any>): Promise<any>;
  async getWrappedInstance(type: any, ctx: Map<any, any>) {
    return this.wrap(await this.getInstance(type, ctx));
  }

  private async _withContext(type, producer, ctx) {
    if (!ctx.has(type)) {
      const inst = await producer();
      ctx.set(type, inst);
    }
    return ctx.get(type);
  }

  private async _withStore(type, producer, ctx) {
    if (!this.hasInStore(type)) {
      const inst = await producer();
      this.setStore(type, inst);
    }
    const inst = this.getStore(type);
    ctx.set(type, inst);
    return inst;
  }

  protected hasInStore(type) {
    if (typeof type == 'function') {
      for (const [k] of this._store) {
        if (k.prototype instanceof type) {
          return true;
        }
      }
    }
    return this._store.has(type);
  }

  protected setStore(type, value) {
    this._store.set(type, value);
  }

  protected getStore(type) {
    if (typeof type == 'function') {
      for (const [k, v] of this._store) {
        if (k.prototype instanceof type) {
          return v;
        }
      }
    }
    return this._store.get(type);
  }

  protected hasInProviders(type) {
    if (typeof type == 'function') {
      for (const [k] of this._providers) {
        if (k.prototype instanceof type) {
          return true;
        }
      }
    }
    return this._providers.has(type);
  }

  protected getProvider(type) {
    if (typeof type == 'function') {
      for (const [k, p] of this._providers) {
        if (k.prototype instanceof type) {
          return p;
        }
      }
    }
    return this._providers.get(type);
  }

  /**
   * wrap a instance, container will proxy all method of instance
   *
   * @param instance
   */
  public wrap<T = any>(instance: T): InjectWrappedInstance<T>;
  public wrap(instance: number): number;
  public wrap(instance: any): any {

    if (typeof instance == 'object') {

      if (instance instanceof InjectContainer) {
        return instance;
      }

      if (instance instanceof Promise) {
        return instance;
      }

      const p = new Proxy(instance, {
        get: (target, property) => {

          if (property == 'constructor') {
            return instance['constructor'];
          }

          if (property in target) {
            const methodOrProperty = target[property];
            if (typeof methodOrProperty == 'function') {
              return (...args: any[]) => this.injectExecute(target, methodOrProperty, ...args);
            }
            return methodOrProperty;
          }

          if (property == WRAPPED_ORIGINAL_OBJECT_PROPERTY) {
            return instance;
          }

          if (property == WRAPPED_OBJECT_INDICATOR) {
            return true;
          }

          return undefined;

        }

      });

      return p;

    }

    return instance;

  }

  /**
   * execute class instance method with inject
   *
   * @param instance
   * @param method
   */
  async injectExecute<F extends (...args: any[]) => any>(instance: any, method: F, ...args: OptionalParameters<F>): Promise<ReturnType<F>>;
  async injectExecute<F extends (...args: any[]) => any>(instance: any, method: F, ...args: any[]): Promise<ReturnType<F>>;
  async injectExecute(instance, method, ...args) {

    const methodName = method.name;
    const type = instance.constructor;
    const paramsInfo = getClassMethodParams(type, methodName);
    const params = args || [];

    if (paramsInfo.length > 0) {
      for (let idx = 0; idx < paramsInfo.length; idx++) {
        const paramInfo = paramsInfo[idx];
        // if user has define the parameter in `injectExecute`, prefer use that
        if (args[paramInfo.parameterIndex] == undefined) {
          params[paramInfo.parameterIndex] = await this.getInstance(paramInfo.type);
        }
      }
    }

    return method.apply(this.wrap(instance), params);
  }

  private async _defaultClassProvider<T extends new (...args: any[]) => any>(type: T, ctx?: Map<any, any>): Promise<InstanceType<T>> {

    const info = getClassInjectionInformation(type);
    const constructParametersInfo = getClassConstructorParams(type);
    const constructParams = [];

    if (constructParametersInfo.length > 0) {
      for (let idx = 0; idx < constructParametersInfo.length; idx++) {
        const paramInfo = constructParametersInfo[idx];
        constructParams[paramInfo.parameterIndex] = await this.getInstance(paramInfo.type, ctx);
      }
    }

    const inst = new type(...constructParams);

    ctx.set(type, inst);

    if (info.size > 0) {
      const keys = info.keys();
      for (const key of keys) {
        const prop = info.get(key);
        if (prop.injectType == 'classProperty') {
          inst[key] = await this.getInstance(prop.type, ctx);
        }
      }
    }

    return inst;

  }

  private _getProviderParams(provider) {
    const type = provider.constructor;
    return getClassMethodParams(type, 'provide');
  }

  private _getClassParams(clazz) {
    return getClassConstructorParams(clazz);
  }

  private _checkDependency(root: any) {

    const g = new Graph({ directed: true });
    const m = new Map();
    let idx = 0;

    const getTypeName = (t) => typeof t == 'function' ? (t.name || getOrDefault(m, t, `Unknown${idx++}`)) : t;

    const lookupDependencies = (t: any) => {

      const typeName = getTypeName(t);
      let params: InjectParameter[] = [];

      if (this.hasInProviders(t)) {
        params = this._getProviderParams(this.getProvider(t));
      } else if (typeof t == 'function') {
        params = this._getClassParams(t);
      }

      if (params.length > 0) {

        params.forEach(({ type }) => {
          // type, maybe an identifier or a function

          if (type instanceof LazyRef) {
            type = type.getRef();
          }

          const paramName = getTypeName(type);

          g.setEdge(typeName, paramName);

          const cycles = alg.findCycles(g);
          if (cycles.length > 0) {
            throw new TypeError(`found cycle dependencies in: ${cycles.map((cycle) => cycle.join(', ')).join('| ')}`);
          }

          lookupDependencies(type);

        });

      }
    };

    try {
      lookupDependencies(root);
    } finally {
      m.clear();
    }


    return;
  }


}

@transient
export class SubLevelInjectContainer extends InjectContainer {

  constructor(@inject(InjectContainer) globalContainer: InjectContainer) {
    super();
    this._parent = globalContainer;
  }

  hasInStore(type) {
    // @ts-ignore
    return super.hasInStore(type) || this._parent.hasInStore(type);
  }

  getStore(type) {
    if (this.hasInStore(type)) {
      if (super.hasInStore(type)) {
        return super.getStore(type);
      }
      // @ts-ignore
      return this._parent.getStore(type);
    }
    return undefined;
  }

  hasInProviders(type) {
    // @ts-ignore
    return super.hasInProviders(type) || this._parent.hasInProviders(type);
  }

  getProvider(type) {
    if (this.hasInProviders(type)) {
      if (super.hasInProviders(type)) {
        return super.getProvider(type);
      }
      // @ts-ignore
      return this._parent.getProvider(type);
    }
    return undefined;
  }


}
