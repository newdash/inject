import { alg, Graph } from 'graphlib';
import { WRAPPED_OBJECT_CONTAINER_PROPERTY, WRAPPED_OBJECT_INDICATOR, WRAPPED_OBJECT_METHOD_INJECT_INFO, WRAPPED_ORIGINAL_OBJECT_PROPERTY } from './constants';
import { getClassConstructorParams, getClassInjectionInformation, getClassMethodParams, inject, InjectParameter, isTransient, LazyRef, transient } from './decorators';
import { createInstanceProvider, DefaultClassProvider, InstanceProvider } from './provider';
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

  async getInstance<T extends Class>(type: LazyRef<T>): Promise<InstanceType<T>>;
  async getInstance<T extends Class>(type: T): Promise<InstanceType<T>>;
  async getInstance(type: any): Promise<any>;
  async getInstance(type: any) {

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

    let provider = undefined;

    const ic = await this.createSubContainer();

    // user define the provider
    if (ic.hasInProviders(type)) {
      provider = ic.wrap(ic.getProvider(type));
    }
    // use default provider for classes
    else if (typeof type == 'function') {
      provider = new DefaultClassProvider(type, isTransient(type), true, ic);
    }

    if (provider) {
      return ic._withStore(type, provider);
    }

    return undefined;
  }

  async getWrappedInstance<T extends Class>(type: LazyRef<T>): Promise<InjectWrappedInstance<InstanceType<T>>>;
  async getWrappedInstance<T extends Class>(type: T): Promise<InjectWrappedInstance<InstanceType<T>>>;
  async getWrappedInstance(type: any): Promise<any>;
  async getWrappedInstance(type: any) {
    return this.wrap(await this.getInstance(type));
  }

  private async _withStore(type, producer: InstanceProvider) {
    // the type direct in store
    if (!this.hasInStore(type)) {
      const inst = await producer.provide();
      if (inst != undefined) {
        this.setStore(type, inst);
      }
      if (!Boolean(producer.transient)) {
        this.getParent().setStore(type, inst);
      }
    }
    return this.getStore(type);
  }

  protected setStore(type, value) {
    this._store.set(type, value);
  }

  protected hasInStore(type) {
    if (this._store.has(type)) {
      return true;
    }
    return false;
  }

  protected hasParentTypeInStore(type): boolean {
    if (typeof type == 'function') {
      for (const [k] of this._store) {
        if (typeof k == 'function') {
          if (type.prototype instanceof k) {
            return true;
          }
        }
      }
    }
    return false;
  }

  protected getStore(type) {
    const rt = this._store.get(type);
    // if (rt == undefined) {
    //   if (typeof type == 'function') {
    //     for (const [k, v] of this._store) {
    //       // the super class maybe registered in storage
    //       if (type.prototype instanceof k) {
    //         rt = v;
    //         break;
    //       }
    //     }
    //   }
    // }
    return rt;
  }

  protected hasInProviders(type) {
    if (this._providers.has(type)) {
      return true;
    }
    // if (typeof type == 'function') {
    //   for (const [k] of this._providers) {
    //     if (k.prototype instanceof type) {
    //       return true;
    //     }
    //   }
    // }
    return false;
  }

  protected getProvider(type) {
    const rt = this._providers.get(type);
    // if (rt == undefined) {
    //   if (typeof type == 'function') {
    //     for (const [k, p] of this._providers) {
    //       if (k.prototype instanceof type) {
    //         rt = p;
    //       }
    //     }
    //   }
    // }
    return rt;
  }

  /**
   * wrap a instance, container will proxy all method of instance
   *
   * @param instance
   */
  public wrap<T = any>(instance: T): InjectWrappedInstance<T>;
  public wrap(instance: number): number;
  public wrap(instance: any): any {

    if (typeof instance == 'object' || typeof instance == 'function') {

      if (instance instanceof InjectContainer) {
        return instance;
      }

      if (instance instanceof Promise) {
        return instance;
      }

      if (instance[WRAPPED_OBJECT_CONTAINER_PROPERTY] == this) {
        return instance;
      }

      const p = new Proxy(instance, {
        construct: (target, args) => {
          const provider = new DefaultClassProvider(target, isTransient(target), true, this);
          return provider.provide(...args);
        },
        get: (target, property) => {

          if (property in target) {
            const methodOrProperty = target[property];
            if (typeof methodOrProperty == 'function') {
              const proxyMethod = (...args: any[]) => this.injectExecute(target, methodOrProperty, ...args);
              proxyMethod[WRAPPED_OBJECT_METHOD_INJECT_INFO] = getClassMethodParams(target, property);
              return proxyMethod;
            }
            return methodOrProperty;
          }

          if (property == WRAPPED_OBJECT_CONTAINER_PROPERTY) {
            return this;
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
    let paramsInfo = [];

    if (method[WRAPPED_OBJECT_METHOD_INJECT_INFO]) {
      // get meta from duplicate
      paramsInfo = method[WRAPPED_OBJECT_METHOD_INJECT_INFO];
    } else {
      // get meta directly by reflect
      paramsInfo = getClassMethodParams(type, methodName);
    }

    const params = args || [];

    if (paramsInfo.length > 0) {
      for (let idx = 0; idx < paramsInfo.length; idx++) {
        const paramInfo = paramsInfo[idx];
        // if user has define the parameter in `injectExecute`, prefer use that
        if (args[paramInfo.parameterIndex] == undefined) {
          params[paramInfo.parameterIndex] = await this.getWrappedInstance(paramInfo.type);
        }
      }
    }

    return method.apply(this.wrap(instance), params);
  }


  private async _defaultClassProvider<T extends new (...args: any[]) => any>(type: T, ctx?: Map<any, any>, ...args: any[]): Promise<InstanceType<T>> {

    const info = getClassInjectionInformation(type);
    const constructParametersInfo = getClassConstructorParams(type);
    const constructParams = args || [];

    if (constructParametersInfo.length > 0) {
      for (let idx = 0; idx < constructParametersInfo.length; idx++) {
        const paramInfo = constructParametersInfo[idx];
        if (args[paramInfo.parameterIndex] == undefined) {
          constructParams[paramInfo.parameterIndex] = await this.getInstance(paramInfo.type);
        }
      }
    }

    const inst = new type(...constructParams);

    ctx.set(type, inst);

    if (info.size > 0) {
      const keys = info.keys();
      for (const key of keys) {
        const prop = info.get(key);
        if (prop.injectType == 'classProperty') {
          inst[key] = await this.getInstance(prop.type);
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
