import { InjectContainer } from "./container";
import { getClassConstructorParams, getClassInjectionInformation } from "./decorators";

export interface InstanceProvider<T = any> {
  /**
   * the type of this provider support
   * 
   * could be string or constructor
   * 
   */
  type: any;
  /**
   * will cache the provider result
   */
  transient?: boolean;
  /**
   * share with sub container
   */
  share?: boolean;
  /**
   * provide/produce instance
   */
  provide: (...args: any[]) => Promise<T>;
}

export const createInstanceProvider = (
  type: any,
  instance: any,
  transient = false,
) => new class implements InstanceProvider {
  transient = transient;
  type = type;
  provide = async () => instance
};


export class DefaultClassProvider implements InstanceProvider {

  type: any;
  transient?: boolean;
  container: InjectContainer;

  /**
   * 
   * @param type 
   * @param transient 
   * @param inherit 
   * @param container should be a sub container
   */
  constructor(type: any, transient = false, container: InjectContainer) {
    this.type = type;
    this.transient = transient;
    this.container = container;
  }

  async provide(...args: any[]) {
    const type = this.type;
    const info = getClassInjectionInformation(type);
    const constructParametersInfo = getClassConstructorParams(type);
    const constructParams = args || [];

    if (constructParametersInfo.length > 0) {
      for (let idx = 0; idx < constructParametersInfo.length; idx++) {
        const paramInfo = constructParametersInfo[idx];
        if (args[paramInfo.parameterIndex] == undefined) {
          constructParams[paramInfo.parameterIndex] = await this.container.getInstance(paramInfo.type, this.container);
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
          inst[key] = await this.container.getInstance(prop.type, this.container);
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