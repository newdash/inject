import { alg, Graph } from 'graphlib';
import { MSG_ERR_NOT_PROVIDER, MSG_ERR_NO_UNDEFINED, MSG_ERR_PROVIDER_DISABLE_WRAP, WRAPPED_OBJECT_METHOD_INJECT_INFO } from './constants';
import { createInjectDecorator, getClassConstructorParams, getClassMethodParams, getProvideInfo, getTransientInfo, getUnProxyTarget, inject, InjectParameter, isNoWrap, isNoWrapProvider, isProviderInstance, isProviderType, isRequired, isTransient, isWrappedObject, LazyRef, transient } from './decorators';
import { RequiredNotFoundError } from './errors';
import { createLogger } from './logger';
import { createInstanceProvider, DefaultClassProvider, InstanceProvider } from './provider';
import { Class, getOrDefault, InjectWrappedClassType, InjectWrappedInstance, isClass, OptionalParameters } from './utils';
import { createWrapper } from './wrapper';

const containerLogger = createLogger("container");

/**
 * overwrite provider instance from sub to parent container
 * 
 * @param type 
 * @param provider 
 * @param ctx 
 */
function overwriteProvider(type: any, provider: InstanceProvider, ctx: InjectContainer) {
  let ic: InjectContainer = ctx;
  for (; ;) {
    // @ts-ignore
    if (ic._providers.has(type)) {
      // @ts-ignore
      ic._providers.set(type, provider);
      break;
    }
    ic = ic.getParent();
    if (ic == undefined) {
      break;
    }
  }
}


/**
 * used to generate id sequence for containers
 */
let containerIdSequence = 0;

function generateContainerId() {
  return containerIdSequence++;
}

/**
 * tmp inject context, store injection temp object in single construction
 */
export type InjectContext = Map<any, any>

/**
 * inject container
 */
export class InjectContainer {

  private _store: Map<any, any>;

  protected _parent: InjectContainer;

  protected _doNotWrapTypes: Set<any>;

  private _providers: Map<any, any>;

  private _id: number;

  private _formattedId: string;

  /**
   * avoid create root inject container directly, 
   * 
   * please use the `InjectContainer.New()` to create a new container, :)
   */
  constructor() {
    this._providers = new Map();
    this._store = new Map();
    this._doNotWrapTypes = new Set();
    this._id = generateContainerId();
  }



  public static New(): InjectContainer {
    return new ChildInjectContainer(new InjectContainer());
  }

  private _log(...args: Parameters<debug.Debugger>) {
    const [template, ...values] = args;
    containerLogger(`container(%o): ${template}`, this.getFormattedId(), ...values);
  }

  /**
   * indicate the type should not be wrapped,
   * 
   * it means the inject container will NEVER return the Proxy of this type object
   */
  public doNotWrap(...types: any[]) {
    types.forEach(type => {
      if (!this._doNotWrapTypes.has(type)) {
        this._log('disable wrapper: %o', type);
        this._doNotWrapTypes.add(type);
      }
    });
  }

  /**
   * get the formatted id of container
   * 
   * e.g. 1->2->3
   */
  public getFormattedId(): string {
    if (this._formattedId == undefined) {
      let c: InjectContainer = this;
      const ids = [];
      for (; ;) {
        ids.push(c._id.toString());
        c = c.getParent();
        if (c == undefined) {
          break;
        }
      }
      this._formattedId = ids.reverse().join("->");
    }
    return this._formattedId;
  }

  protected canWrap(type: any): boolean {
    if (type instanceof LazyRef) {
      type = type.getRef();
    }
    // class is not registered in providers, (constructed by DefaultClassProvider)
    if (isClass(type) && isNoWrap(type)) { return false; }
    return !(this._doNotWrapTypes.has(type));
  }

  /**
   * get parent inject container
   */
  public getParent(): InjectContainer {
    return this._parent;
  }

  public registerProvider(provider: InstanceProvider): void;
  public registerProvider(provider: Class<InstanceProvider>): void;
  public registerProvider(...providers: Array<InstanceProvider | Class<InstanceProvider>>): void;
  public registerProvider(...providers: any[]) {
    providers.forEach(provider => {
      if (provider == undefined) { throw new TypeError(MSG_ERR_NO_UNDEFINED); }
      let type = getProvideInfo(provider, "provide");
      if (isProviderInstance(provider)) {
        type = getProvideInfo(provider, "provide");
      }
      else if (isProviderType(provider)) {
        type = getProvideInfo(provider.prototype, "provide");
      }
      if (type != undefined) {
        if (this.hasInProviders(type)) {
          this._log('overwrite provider: %O', type);
        } else {
          this._log('register provider: %O', type);
        }
        // provider must could be wrapped, 
        // otherwise, the 'provide' function could not be injected
        if (isNoWrap(provider)) {
          throw new TypeError(MSG_ERR_PROVIDER_DISABLE_WRAP);
        }
        if (isNoWrapProvider(provider) || isNoWrap(type)) { this.doNotWrap(type); }
        this._providers.set(type, provider);
      }
      else { throw new TypeError(MSG_ERR_NOT_PROVIDER); }
    });
  }

  /**
   * register a instance into container directly
   * 
   * @param type 
   * @param instance 
   * @param transient 
   * 
   * @returns the inject decorator of the type
   */
  public registerInstance(type: any, instance: any, transient: boolean = false) {
    this.registerProvider(createInstanceProvider(type, instance, transient));
    return createInjectDecorator(type);
  }

  public async createSubContainer(): Promise<InjectContainer> {
    // @ts-ignore
    return new ChildInjectContainer(this);
  }

  async getInstance<T extends Class>(type: LazyRef<T>, ctx?: InjectContainer): Promise<InstanceType<T>>;
  async getInstance<T extends Class>(type: T, ctx?: InjectContainer): Promise<InstanceType<T>>;
  async getInstance(type: any, ctx?: InjectContainer): Promise<any>;
  async getInstance(type: any, ctx?: InjectContainer) {

    if (ctx == undefined) {
      ctx = await this.createSubContainer();
    }

    type = getUnProxyTarget(type);

    if (type instanceof LazyRef) {
      type = type.getRef();
    }

    // if target require inject the 'InjectContainer',
    // just inject a sub container,
    // and it will useful for many scenarios
    // :)
    if (type == InjectContainer || type == ChildInjectContainer) {
      return await this.createSubContainer();
    }

    // if class has cycle dependency in constructor, throw error
    ctx._checkDependency(type);

    let provider = undefined;

    // prefer use context as 'container'
    // user define the provider
    if (ctx.hasInProviders(type)) {
      provider = ctx.wrap(ctx.getProvider(type));
    }
    else if (ctx.hasSubClassProvider(type)) {
      provider = ctx.wrap(ctx.getSubClassProvider(type));
    }
    // use default provider for classes
    else if (typeof type == 'function') {
      provider = new DefaultClassProvider(type, isTransient(type), ctx);
    }

    if (isProviderType(provider)) {
      let overwrite = true;
      if (isTransient(provider)) {
        overwrite = false;
      }
      // just overwrite the provider type provider
      provider = await ctx.getWrappedInstance(provider);
      if (overwrite) {
        // store provider instance to parent
        overwriteProvider(type, provider, ctx);
      }
    }

    if (provider) {
      return ctx._withStore(type, provider);
    }

    return undefined;
  }

  async getWrappedInstance<T extends Class>(type: LazyRef<T>, ctx?: InjectContainer): Promise<InjectWrappedInstance<InstanceType<T>>>;
  async getWrappedInstance<T extends Class>(type: T, ctx?: InjectContainer): Promise<InjectWrappedInstance<InstanceType<T>>>;
  async getWrappedInstance(type: any, ctx?: InjectContainer): Promise<any>;
  async getWrappedInstance(type: any, ctx?: InjectContainer) {
    const inst = await this.getInstance(type, ctx);

    if (this.canWrap(type)) {
      return this.wrap(inst);
    }
    return inst;
  }

  private async _withStore(type, provider: InstanceProvider, ...args: any[]) {

    // the type direct in store
    if (!this.hasInStore(type)) {

      if (this.hasSubClassInstanceInStore(type)) {
        return this.getSubClassInstance(type); // do not cache it
      }

      const inst = await provider.provide(...args);

      if (getTransientInfo(provider, "provide")) {
        return inst;
      }

      if (inst != undefined) {
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

  protected hasSubClassInstanceInStore(type: any): boolean {
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

  protected getSubClassInstance(type: any): boolean {
    if (typeof type == 'function') {
      for (const [k, v] of this._store) {
        // the super class maybe registered in storage
        if (type.prototype instanceof k) {
          return v;
        }
      }
    }
    return undefined;
  }

  protected getStore(type) {
    return this._store.get(type);
  }

  protected hasInProviders(type) {
    return this._providers.has(type);
  }

  /**
   * get provider by type
   * 
   * @param type 
   */
  protected getProvider(type: any): any {
    return this._providers.get(type);
  }

  protected hasSubClassProvider(type) {
    if (typeof type == 'function') {
      for (const [k] of this._providers) {
        if (k.prototype instanceof type) {
          return true;
        }
      }
    }
    return false;
  }

  protected getSubClassProvider(type: any): any {
    if (typeof type == 'function') {
      for (const [k, p] of this._providers) {
        if (k.prototype instanceof type) {
          return p;
        }
      }
    }
  }

  /**
   * wrap a class, so the constructor/static methods will automatic be proxy 
   * 
   * @param instance 
   */
  public wrap<T extends Class = any>(instance: T): InjectWrappedClassType<T>;
  /**
   * wrap a instance, container will proxy all method of instance
   *
   * @param instance
   */
  public wrap<T = any>(instance: T): InjectWrappedInstance<T>;
  public wrap(instance: number): number;
  public wrap(instance: any): any {
    return createWrapper(instance, this);
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
    let type;

    if (isClass(instance)) {
      type = instance;
    } else {
      type = instance?.constructor;
    }

    let methodInjectionParameterMetadata: InjectParameter[] = [];

    if (method[WRAPPED_OBJECT_METHOD_INJECT_INFO]) {
      // get meta from duplicate
      methodInjectionParameterMetadata = method[WRAPPED_OBJECT_METHOD_INJECT_INFO];
    } else {
      // get meta directly by reflect
      methodInjectionParameterMetadata = getClassMethodParams(instance, methodName);
    }

    const methodParameters = args || [];

    if (methodInjectionParameterMetadata.length > 0) {
      for (let idx = 0; idx < methodInjectionParameterMetadata.length; idx++) {
        const paramInfo = methodInjectionParameterMetadata[idx];
        // if user has define the parameter in `injectExecute`, prefer use that
        if (args[paramInfo.parameterIndex] == undefined) {

          const log = (format, typeName) => {
            this._log(format,
              typeName,
              methodName,
              paramInfo.parameterIndex,
              paramInfo.type,
              methodParameters[paramInfo.parameterIndex],
            );
          };
          if (isNoWrap(instance, methodName, paramInfo.parameterIndex)) {
            methodParameters[paramInfo.parameterIndex] = await this.getInstance(paramInfo.type);
          } else {
            methodParameters[paramInfo.parameterIndex] = await this.getWrappedInstance(paramInfo.type);
          }
          const unProxyObject = getUnProxyTarget(instance);
          if (isClass(unProxyObject)) {
            log(
              "before call static method '%s.%s', inject parameter (%o: %o) with value: %O",
              unProxyObject?.name,
            );
          } else {
            log(
              "before call '%s.%s', inject parameter (%o: %o) with value: %O",
              unProxyObject?.constructor?.name,
            );
          }
          if (methodParameters[paramInfo.parameterIndex] == undefined) {
            if (!isWrappedObject(instance)) {
              if (isRequired(instance, methodName, paramInfo.parameterIndex)) {
                throw new RequiredNotFoundError(type, methodName, paramInfo.parameterIndex);
              }
            }
          }
        }
      }
    }

    if (this.canWrap(type)) {
      instance = this.wrap(instance);
    }

    return method.apply(instance, methodParameters);
  }

  private _getProviderParams(provider) {
    const type = provider.constructor.prototype;
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

/**
 * child level Inject Container
 */
@transient
export class ChildInjectContainer extends InjectContainer {

  constructor(@inject(InjectContainer) parentContainer: InjectContainer) {
    super();
    this._parent = parentContainer;
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


  protected hasSubClassInstanceInStore(type: any): boolean {
    if (super.hasSubClassInstanceInStore(type)) {
      return true;
    }
    // @ts-ignore
    return this._parent.hasSubClassInstanceInStore(type);
  }

  protected getSubClassInstance(type: any): boolean {
    let rt = super.getSubClassInstance(type);
    if (rt == undefined) {
      // @ts-ignore
      rt = this._parent.getSubClassInstance(type);
    }
    return rt;
  }


  protected hasSubClassProvider(type) {
    if (super.hasSubClassProvider(type)) {
      return true;
    }
    // @ts-ignore
    return this._parent.hasSubClassProvider(type);
  }

  protected getSubClassProvider(type) {
    let rt = super.getSubClassProvider(type);
    if (rt == undefined) {
      // @ts-ignore
      rt = this._parent.getSubClassProvider(type);
    }
    return rt;
  }

  protected canWrap(type: any) {
    // @ts-ignore
    return super.canWrap(type) && this._parent.canWrap(type);
  }

}
