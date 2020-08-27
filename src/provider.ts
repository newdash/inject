import { InjectContainer } from "./container";
import { getClassConstructorParams, getClassInjectionInformation, getUnProxyTarget, inject, isNoWrap, isRequired, LazyRef, noWrap, provider, transient } from "./decorators";
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

  private _registerInjectParam(ic: InjectContainer, injectParams: any) {
    Object.keys(injectParams).forEach(key => {
      const value = injectParams[key];
      this._log("provide transient param %o with value: %O", key, value);
      ic.registerInstance(key, value, true);
    });
  }

  async provide(...args: any[]) {
    const type = this.type;
    const info = getClassInjectionInformation(type.prototype);
    const constructParametersInfo = getClassConstructorParams(type);
    const constructParams = args || [];
    const ic = this.container;

    if (constructParametersInfo.length > 0) {
      for (let idx = 0; idx < constructParametersInfo.length; idx++) {
        const paramInfo = constructParametersInfo[idx];
        if (args[paramInfo.parameterIndex] == undefined) {

          this._registerInjectParam(ic, inject.getInjectParameter(type, undefined, paramInfo.parameterIndex));

          let paramValue = undefined;
          if (isNoWrap(type, undefined, paramInfo.parameterIndex)) {
            paramValue = await ic.getInstance(paramInfo.type, ic);
          } else {
            paramValue = await ic.getWrappedInstance(paramInfo.type, ic);
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
      for (const propertyName of keys) {
        const propInjectMetadata = info.get(propertyName);
        if (propInjectMetadata.injectType == 'classProperty') {
          let type = propInjectMetadata.type;
          if (type instanceof LazyRef) {
            type = type.getRef();
          }

          this._registerInjectParam(ic, inject.getInjectParameter(inst, propertyName));

          // if the instance decorate this field disable wrapper
          if (isNoWrap(inst, propertyName)) {
            inst[propertyName] = await ic.getInstance(type, ic);
          } else {
            inst[propertyName] = await ic.getWrappedInstance(type, ic);
          }
          this._log("after %o instance created, inject property (%o: %o) with value: %o",
            getUnProxyTarget(type),
            propertyName,
            type,
            inst[propertyName],
          );
          if (inst[propertyName] === undefined) {
            if (isRequired(inst, propertyName)) {
              throw new RequiredNotFoundError(inst, propertyName);
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