
export interface InstanceProvider<T = any> {
  type: any;
  transient?: boolean;
  provide: (...args: any[]) => Promise<T>;
}

export const createInstanceProvider = (type: any, instance: any, transient = false) => new class implements InstanceProvider {
  transient = transient;
  type = type;
  provide = async () => instance
};
