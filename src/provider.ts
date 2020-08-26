import { InjectContainer } from "./container";
import { getClassConstructorParams, getClassInjectionInformation, getUnProxyTarget, isNoWrap, isRequired, LazyRef, noWrap, provider, transient } from "./decorators";
import { RequiredNotFoundError } from "./errors";
import { createLogger } from "./logger";


const classProviderLogger = createLogger("classProvider");


export interface InstanceProvider<T = any> {
  /**
   * provide/produce instance
   */
  provide: (...args: any[]) => any;
}

export const createInstanceProvider = (type: any, instance: any, isTransient = false) => {

  const p = class {
    provide = async () => instance
  };

  provider(type)(p);
  provider(type)(p.prototype, "provide");
  if (isTransient) {
    transient(p.prototype, "provide");
  }
  return new p;

};


export class DefaultClassProvider implements InstanceProvider {

  type: any;
  transient?: boolean;
  container: InjectContainer;

  /**
   * 
   * @param type 
   * @param bTransient 
   * @param inherit 
   * @param container should be a sub container
   */
  constructor(type: any, bTransient = false, container?: InjectContainer) {
    provider(type)(this, "provide");
    if (bTransient) {
      transient(this, "provide");
    }
    if (isNoWrap(type)) {
      noWrap(this, "provide");
    }
    this.type = type;
    this.transient = bTransient;
    this.container = container;
  }

  private _log(...args: Parameters<debug.Debugger>) {
    const [tmp, ...values] = args;
    classProviderLogger(
      `type(%o), container(%o), ${tmp}`,
      this.type,
      this.container.getFormattedId(),
      ...values
    );
  }

  async provide(...args: any[]) {
    const type = this.type;
    const info = getClassInjectionInformation(type.prototype);
    const constructParametersInfo = getClassConstructorParams(type);
    const constructParams = args || [];

    if (constructParametersInfo.length > 0) {
      for (let idx = 0; idx < constructParametersInfo.length; idx++) {
        const paramInfo = constructParametersInfo[idx];
        if (args[paramInfo.parameterIndex] == undefined) {
          let paramValue = undefined;
          if (isNoWrap(type, undefined, paramInfo.parameterIndex)) {
            paramValue = await this.container.getInstance(
              paramInfo.type,
            );
          } else {
            paramValue = await this.container.getWrappedInstance(
              paramInfo.type,
            );
          }

          constructParams[paramInfo.parameterIndex] = paramValue;

          this._log("before %o instance creating, inject constructor parameter (%o: %o) with value %O",
            getUnProxyTarget(type),
            paramInfo.parameterIndex,
            paramInfo.type,
            paramValue,
          );

          if (paramValue === undefined) {
            if (isRequired(type, undefined, paramInfo.parameterIndex)) {
              throw new RequiredNotFoundError(type, undefined, paramInfo.parameterIndex);
            }
          }
        }
      }
    }

    const inst = new type(...constructParams);

    // force store current container provided type
    // @ts-ignore
    this.container.setStore(this.type, inst);

    if (info.size > 0) {
      const keys = info.keys();
      for (const key of keys) {
        const prop = info.get(key);
        if (prop.injectType == 'classProperty') {
          let type = prop.type;
          if (type instanceof LazyRef) {
            type = type.getRef();
          }
          // if the instance decorate this field disable wrapper
          if (isNoWrap(inst, key)) {
            inst[key] = await this.container.getInstance(type, this.container);
          } else {
            inst[key] = await this.container.getWrappedInstance(type, this.container);
          }
          this._log("after %o instance created, inject property (%o: %o) with value: %o",
            getUnProxyTarget(type),
            key,
            type,
            inst[key],
          );
          if (inst[key] === undefined) {
            if (isRequired(inst, key)) {
              throw new RequiredNotFoundError(inst, key);
            }
          }
        }
      }
    }

    if (!this.transient) {
      const parent = this.container.getParent();
      if (parent) {
        // @ts-ignore
        parent.setStore(this.type, inst);
      }
    }

    return inst;
  }

}