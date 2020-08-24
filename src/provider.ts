import { InjectContainer } from "./container";
import { getClassConstructorParams, getClassInjectionInformation, getUnProxyTarget, LazyRef, provider, transient } from "./decorators";
import { createLogger } from "./logger";


const logger = createLogger("defaultClassProvider");


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
  constructor(type: any, bTransient = false, container: InjectContainer) {
    provider(type)(this, "provide");
    if (bTransient) {
      transient(this, "provide");
    }
    this.type = type;
    this.transient = bTransient;
    this.container = container;
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
          constructParams[paramInfo.parameterIndex] = await this.container.getWrappedInstance(
            paramInfo.type,
          );
          logger("c(%o), before %o instance creating, inject constructor parameter (%o: %o) with value %o",
            this.container.getFormattedId(),
            getUnProxyTarget(type),
            paramInfo.parameterIndex,
            paramInfo.type,
            constructParams[paramInfo.parameterIndex],
          );
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
          inst[key] = await this.container.getWrappedInstance(type, this.container);
          logger("c(%o), after %o instance created, inject property (%o: %o) with value: %O",
            this.container.getFormattedId(),
            getUnProxyTarget(type),
            key,
            type,
            inst[key],
          );
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