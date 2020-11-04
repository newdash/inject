import { isClass } from '@newdash/newdash/isClass';
import { alg, Graph } from 'graphlib';
import { I_INJECT_CTX, MSG_ERR_NOT_PROVIDER, MSG_ERR_NO_UNDEFINED, MSG_ERR_PROVIDER_DISABLE_WRAP, MSG_ERR_TYPE_NOT_VALID, S_TYPE_FUNCTION } from './constants';
import { createInjectDecorator, getClassConstructorParams, getClassMethodParams, getProvideInfo, getTransientInfo, getUnProxyTarget, inject, InjectParameter, isNoWrap, isNoWrapProvider, isProviderInstance, isProviderType, isRequired, isTransient, isWrappedFunction, isWrappedObject, LazyRef, transient } from './decorators';
import { RequiredNotFoundError } from './errors';
import { createLogger } from './logger';
import { BaseInstanceProvider, DefaultClassProvider, InstanceProvider } from './provider';
import { Class, getOrDefault, InjectWrappedClassType, InjectWrappedInstance, OptionalParameters, typeToString } from './utils';
import { createWrapper } from './wrapper';

const containerLogger = createLogger("container");

/**
 * the context of injection
 */
export interface InjectContext {
  /**
   * parent object
   */
  injectParent?: any
  injectProperty?: any
  injectParameterIdx?: any
  /**
   * inject params
   */
  injectParam?: any
  /**
   * inject args
   */
  injectArgs?: any[]

}


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
      containerLogger('overwrite provider: %o, %o into container(%o)', type, provider, ic.getFormattedId());
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
 * inject container
 */
export class InjectContainer {

  private _store: Map<any, any>;

  protected _parent: InjectContainer;

  protected _root: InjectContainer;

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

  public getRoot(): InjectContainer {
    if (this._root === undefined) {
      return this;
    } else {
      return this._root;
    }
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
        const sType = typeToString(type);
        if (this.hasInProviders(type)) {

          if (provider instanceof BaseInstanceProvider) {
            this._log('overwrite instance for type: %O with value %O ', sType, provider._providedValue,);
          } else {
            this._log('overwrite provider for type: %O with %O ', sType, provider);
          }

        } else {

          if (provider instanceof BaseInstanceProvider) {
            this._log('register instance for type: %O with value %O ', sType, provider._providedValue,);
          } else {
            this._log('register provider for type: %O with %O ', sType, provider);
          }

        }

        // provider must could be wrapped, 
        // otherwise, the 'provide' function could not be injected
        if (isNoWrap(provider)) {
          throw new TypeError(MSG_ERR_PROVIDER_DISABLE_WRAP);
        }
        // register the type is not should be wrapped globally
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
   */
  public registerInstance(type: any, instance: any) {
    type = this._getType(type)
    this.setStore(type, instance)
    return createInjectDecorator(type)
  }

  public async createSubContainer(): Promise<InjectContainer> {
    // @ts-ignore
    return new ChildInjectContainer(this);
  }

  private _getType(type: any): any {
    type = getUnProxyTarget(type);
    if (type === undefined || type === null) {
      throw new Error(MSG_ERR_TYPE_NOT_VALID)
    }
    if (type instanceof LazyRef) {
      type = type.getRef();
    }
    return type
  }

  async getInstance<T extends Class>(type: LazyRef<T>, ctx?: InjectContext): Promise<InstanceType<T>>;
  async getInstance<T extends Class>(type: T, ctx?: InjectContext): Promise<InstanceType<T>>;
  async getInstance(type: any, ctx?: InjectContext): Promise<any>;
  async getInstance(type: any, ctx?: InjectContext) {

    this._log("require instance for type %o", typeToString(type));

    type = this._getType(type)

    if (this.hasInStore(type)) {
      this._log("found type(%o) instance in cache", typeToString(type));
      return this.getStore(type);
    }

    // if target require inject the 'InjectContainer',
    // just inject a sub container,
    // and it will useful for many scenarios
    // :)
    if (type == InjectContainer || type == ChildInjectContainer) {
      return this;
    }

    // if class has cycle dependency in constructor, throw error
    this._checkDependency(type);


    let provider = undefined;

    // prefer use context as 'container'
    // user define the provider
    if (this.hasInProviders(type)) {
      this._log("found provider for type(%o)", typeToString(type));
      provider = this.getProvider(type);
    }
    else if (this.hasSubClassProvider(type)) {
      this._log("found sub-class provider for type(%o)", typeToString(type));
      provider = this.getSubClassProvider(type);
    }
    // use default provider for classes
    else if (isClass(type)) {
      this._log("not found provider for type(%o), fallback to use DefaultClassProvider", typeToString(type));
      provider = new DefaultClassProvider(type, isTransient(type), this);
    }

    if (isProviderType(provider)) {
      let overwrite = true;
      if (isTransient(provider)) {
        overwrite = false;
      }
      // just overwrite the provider type provider
      provider = await this.getInstance(provider);
      if (overwrite) {
        // store provider instance to parent
        overwriteProvider(type, provider, this);
      }
    }

    if (provider) {
      return await this._withStore(type, provider, ctx);
    }

    return undefined;

  }

  async getWrappedInstance<T extends Class>(type: LazyRef<T>, params?: any): Promise<InjectWrappedInstance<InstanceType<T>>>;
  async getWrappedInstance<T extends Class>(type: T, params?: any): Promise<InjectWrappedInstance<InstanceType<T>>>;
  async getWrappedInstance(type: any, params?: any): Promise<any>;
  async getWrappedInstance(type: any, params?: any) {
    const inst = await this.getInstance(type, params);

    if (this.canWrap(type)) {
      return this.wrap(inst);
    }
    return inst;
  }

  private async _withStore(type, provider: InstanceProvider, ctx: InjectContext) {

    // the type direct in store
    if (!this.hasInStore(type)) {

      // do not cache it
      if (this.hasSubClassInstanceInStore(type)) { return this.getSubClassInstance(type); }

      const inst = await this.injectExecute(provider, provider.provide, ctx)

      // do not cache @transient provider
      if (getTransientInfo(provider, "provide")) { return inst; }

      // do not cache provider instance
      if (isProviderType(type)) { return inst; }

      if (inst != undefined) { this.getParent().setStore(type, inst); }

    }

    return this.getStore(type);
  }

  protected setStore(type, value) {
    this._log('store type %o with value: %O', typeToString(type), value);
    this._store.set(type, value);
  }

  protected hasInStore(type) {
    if (this._store.has(type)) {
      return true;
    }
    return false;
  }

  protected hasSubClassInstanceInStore(type: any): boolean {
    if (typeof type === S_TYPE_FUNCTION) {
      for (const [k] of this._store) {
        if (typeof k === S_TYPE_FUNCTION) {
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
  async injectExecute<F extends (...args: any[]) => any>(instance: any, method: F, ctx: InjectContext, ...args: OptionalParameters<F>): Promise<ReturnType<F>>;
  async injectExecute<F extends (...args: any[]) => any>(instance: any, method: F, ctx: InjectContext, ...args: any[]): Promise<ReturnType<F>>;
  async injectExecute(instance: any, method: Function, ctx: InjectContext, ...args: any[]) {

    const methodName = method.name;
    let type;

    if (isClass(instance)) {
      type = instance;
    } else {
      type = instance?.constructor;
    }

    const methodInjectionParameterMetadata = getClassMethodParams(getUnProxyTarget(instance), methodName);

    const methodParameters = args || [];

    if (methodInjectionParameterMetadata.length > 0) {
      for (let idx = 0; idx < methodInjectionParameterMetadata.length; idx++) {
        const paramInfo = methodInjectionParameterMetadata[idx];
        if (paramInfo === undefined) { continue; }
        // if user has define the parameter in `injectExecute`, prefer use that
        if (args[paramInfo.parameterIndex] === undefined) {
          const ic = await this.createSubContainer();

          let itemCtx: InjectContext

          if (isProviderInstance(instance) && methodName === 'provide') {
            itemCtx = ctx
          } else {
            itemCtx = {
              injectParent: instance,
              injectProperty: methodName,
              injectParameterIdx: paramInfo.parameterIndex,
              injectParam: inject.getInjectParameter(instance, methodName, paramInfo.parameterIndex),
            }
          }

          const log = (format: string, typeName: string) => {
            this._log(format,
              typeName,
              methodName,
              paramInfo.parameterIndex,
              paramInfo.type,
              methodParameters[paramInfo.parameterIndex],
            );
          };

          if (ctx?.injectParam && paramInfo.type in ctx?.injectParam) {
            methodParameters[paramInfo.parameterIndex] = ctx.injectParam[paramInfo.type]
          }
          else if (paramInfo.type === I_INJECT_CTX) {
            methodParameters[paramInfo.parameterIndex] = itemCtx
          }
          else if (isNoWrap(instance, methodName, paramInfo.parameterIndex)) {
            methodParameters[paramInfo.parameterIndex] = await ic.getInstance(paramInfo.type, itemCtx);
          }
          else {
            methodParameters[paramInfo.parameterIndex] = await ic.getWrappedInstance(paramInfo.type, itemCtx);
          }

          const unProxyObject = getUnProxyTarget(instance);
          if (isClass(unProxyObject)) {
            log(
              "pre:execution static method '%s.%s', inject parameter (%o: %o) with value: %O",
              unProxyObject?.name,
            );
          } else {
            log(
              "pre:execution '%s.%s', inject parameter (%o: %o) with value: %O",
              unProxyObject?.constructor?.name,
            );
          }
          if (methodParameters[paramInfo.parameterIndex] == undefined) {
            if (!isWrappedObject(instance) && !isWrappedFunction(method)) {
              if (isRequired(instance, methodName, paramInfo.parameterIndex)) {
                throw new RequiredNotFoundError(instance, methodName, paramInfo.parameterIndex, paramInfo.type);
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

        params.filter(p => p !== undefined).forEach(({ type }) => {
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
    this._root = parentContainer.getRoot();
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
