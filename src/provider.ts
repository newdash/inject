import { I_INJECT_CTX, I_INJECT_CTX_SKIP } from "./constants";
import { InjectContainer, InjectContext } from "./container";
import { getClassConstructorParams, getClassInjectionInformation, getUnProxyTarget, inject, isNoWrap, isProviderType, isRequired, isTransient, LazyRef, noWrap, provider, transient } from "./decorators";
import { RequiredNotFoundError } from "./errors";
import { createLogger } from "./logger";
import { getClassName } from "./utils";


const classProviderLogger = createLogger("classProvider");


export interface InstanceProvider<T = any> {
  /**
   * provide/produce instance
   */
  provide: (...args: any[]) => any;
}

export class BaseInstanceProvider {
  _providedValue: any
}

export const createInstanceProvider = (type: any, instance: any, isTransient = false) => {

  const p = class extends BaseInstanceProvider {
    provide = async () => instance
    _providedValue = instance
  };

  provider(type)(p.prototype, "provide", undefined);
  if (isTransient) {
    transient(p.prototype, "provide");
  }
  return new p;

};


@noWrap
export class DefaultClassProvider implements InstanceProvider {

  static [I_INJECT_CTX_SKIP] = true

  @noWrap
  type: any;
  transient?: boolean;
  @noWrap
  container: InjectContainer;

  /**
   * 
   * @param type 
   * @param bTransient is transient for type
   * @param inherit 
   * @param container should be a sub container
   */
  constructor(type: any, bTransient = false, container?: InjectContainer) {
    provider(type)(this, "provide", undefined);
    if (bTransient) { transient(this, "provide"); }
    if (isNoWrap(type)) { noWrap(this, "provide"); }
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

  async provide(@inject(I_INJECT_CTX) ctx: InjectContext = {}) {
    const type = this.type;
    const info = getClassInjectionInformation(type.prototype);
    const constructParametersInfo = getClassConstructorParams(type);
    const constructParams = ctx?.injectArgs ?? [];
    const ic = this.container;

    if (constructParametersInfo.length > 0) {
      for (let idx = 0; idx < constructParametersInfo.length; idx++) {
        const paramInfo = constructParametersInfo[idx];
        if (paramInfo == undefined) { continue; }
        if (constructParams[paramInfo.parameterIndex] !== undefined) { continue; }

        const itemCtx: InjectContext = {
          injectParent: type,
          injectParameterIdx: paramInfo.parameterIndex,
          injectParam: inject.getInjectParameter(type, undefined, paramInfo.parameterIndex)
        }

        let paramValue = undefined;

        if (ctx?.injectParam && paramInfo.type in ctx?.injectParam) {
          paramValue = ctx.injectParam[paramInfo.type]
        }
        else if (paramInfo.type === I_INJECT_CTX) {
          paramValue = itemCtx
        }
        else if (isNoWrap(type, undefined, paramInfo.parameterIndex)) {
          paramValue = await ic.getInstance(paramInfo.type, itemCtx);
        }
        else {
          paramValue = await ic.getWrappedInstance(paramInfo.type, itemCtx);
        }

        constructParams[paramInfo.parameterIndex] = paramValue;

        this._log("pre:constructs %o instance, inject constructor parameter (%o: %o) with value %O",
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

    const inst = new type(...constructParams);

    // force store current container provided type
    if (!isTransient(this.type) && !isProviderType(type)) {
      // @ts-ignore
      this.container.setStore(this.type, inst);
    }

    if (info.size > 0) {
      const propertiesNames = info.keys();
      for (const propertyName of propertiesNames) {
        const propInjectMetadata = info.get(propertyName);
        if (propInjectMetadata.injectType === 'classProperty') {
          let injectPropType = propInjectMetadata.type;
          if (injectPropType instanceof LazyRef) {
            injectPropType = injectPropType.getRef();
          }

          const itemCtx: InjectContext = {
            injectParent: inst,
            injectProperty: propertyName,
            injectParam: inject.getInjectParameter(inst, propertyName)
          }

          // if the instance decorate this field disable wrapper
          if (ctx?.injectParam && injectPropType in ctx?.injectParam) {
            inst[propertyName] = ctx.injectParam[injectPropType]
          }
          else if (injectPropType === I_INJECT_CTX) {
            inst[propertyName] = itemCtx
          }
          else if (isNoWrap(inst, propertyName)) {
            inst[propertyName] = await ic.getInstance(injectPropType, itemCtx);
          }
          else {
            inst[propertyName] = await ic.getWrappedInstance(injectPropType, itemCtx);
          }

          this._log("after:constructed %o instance, inject property (%o: %o) with value: %O",
            getClassName(getUnProxyTarget(type)),
            propertyName,
            injectPropType,
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

    return inst;
  }

}