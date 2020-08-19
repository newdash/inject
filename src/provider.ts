
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
   * sub container
   */
  inherit?: boolean;
  /**
   * provide/produce instance
   */
  provide: (...args: any[]) => Promise<T>;
}

export const createInstanceProvider = (
  type: any,
  instance: any,
  transient = false,
  inherit = true
) => new class implements InstanceProvider {
  transient = transient;
  type = type;
  inherit = inherit;
  provide = async () => instance
};
