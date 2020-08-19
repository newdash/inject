import { disableProxy, getClassMethodParams, getUnProxyTarget, inject, InjectContainer } from "../src";


describe('Wrapper Test Suite', () => {

  it('should support wrapper of instance', async () => {

    class Base {
      sub(@inject('v1') v1: number, @inject('v2') v2: number): number {
        return v1 - v2;
      }
    }

    class A extends Base {
      @inject('v')
      v: number;

      sum(@inject('v1') v1: number, @inject('v2') v2: number): number {
        return v1 + v2;
      }
      async _getV1(@inject('v1') v1?: number) {
        return v1;
      }
      async _getV2(@inject('v2') v2?: number) {
        return v2;
      }
      async _getSum(): Promise<number> {
        return (await this._getV1()) + (await this._getV2());
      }
    }

    const c = InjectContainer.New();
    c.registerInstance('v', 15);
    c.registerInstance('v1', 1);
    c.registerInstance('v2', 2);

    const aw = await c.getWrappedInstance(A);

    // all function will be transformed to 'async' function
    expect(await aw.sum()).toBe(3); // injected (1) + injected (2)
    expect(await aw.sub()).toBe(-1); // injected (1) - injected (2)
    expect(await aw.sum(15)).toBe(17); // 15 + injected (2)
    expect(await aw.sub(15)).toBe(13); // 15 - injected (2)
    expect(await aw.sum(undefined, 99)).toBe(100); // injected (1) + 99
    expect(await aw.sub(undefined, 99)).toBe(-98); // injected (1) - 99

    // even no parameter given, and no parameters given to '_getSum' function
    // the 'this' object is replaced with a dynamic proxy
    // and 'inject container' will automatic fullfil the `undefined` values
    expect(await aw._getSum()).toBe(3);
    expect(aw.v).toBe(15);

  });

  it('should support deep wrapper for object', async () => {

    class A {
      async result(@inject("v1") v1: number, @inject("v2") v2: number) {
        return v1 + v2;
      }
    }

    const c = InjectContainer.New();
    const c2 = await c.createSubContainer();
    const c3 = await c.createSubContainer();

    c2.registerInstance("v1", 1);
    c2.registerInstance("v2", 1);

    c3.registerInstance("v2", 11);

    const a = await c2.getInstance(A);
    const aW = c2.wrap(a);
    const aW2 = c2.wrap(aW);

    expect(aW).toBe(aW2); // do not return wrapper again for same instance

    const aWW = c3.wrap(aW);

    expect(await aW.result()).toBe(2);
    expect(await aWW.result()).toBe(12); // deep wrapper

  });


  it('should support inject wrapped object with ', async () => {

    class A {
      async calculate(@inject("v") v?: number) {
        return v + 1;
      }
    }

    class B {
      async run(@inject(A) a?: A) {
        return await a.calculate();
      }
    }

    const c = InjectContainer.New();
    c.registerInstance("v", 999);

    const b = await c.getWrappedInstance(B);
    expect(await b.run()).toBe(1000);

  });

  it('should support proxy constructor', async () => {

    const c = InjectContainer.New();

    c.registerInstance("v", 111);

    class A {
      v: number
      a: number
      constructor(@inject("v") v: number, a: number) {
        this.v = v;
        this.a = a;
      }
    }

    const wA = c.wrap(A);

    const a = await new wA();
    expect(a.v).toBe(111);

    // support overwrite by give parameters
    const a2 = await new wA(3, 3);
    expect(a2.v).toBe(3);
    expect(a2.a).toBe(3);

    // even register provider
    c.registerInstance(A, new A(999, 100));

    // also will use default class provider, will not found value from store
    const a3 = await new wA(undefined, 100);
    expect(a3.v).toBe(111);
    expect(a3.a).toBe(100);

    // but `getInstance` will apply storage, the latest constructed instance
    const a4 = await c.getInstance(A);
    expect(a4.v).toBe(111);
    expect(a4.a).toBe(100);
    expect(a4).toBe(a3);
  });


  it('should not wrap single container again', async () => {

    class A {
      run(@inject("a") a) {
        return a;
      }
    }

    const a = new A();
    const ic = InjectContainer.New();
    ic.registerInstance("a", 1);
    const aw = ic.wrap(a);
    const aw2 = ic.wrap(aw);

    expect(await aw.run()).toBe(1);

    expect(aw).toBe(aw2);

  });

  it('should get inject metadata even with wrapper', () => {
    class A {
      run(@inject("a") a) {
        return a;
      }
    }

    const a = new A();
    const ic = InjectContainer.New();
    ic.registerInstance("a", 1);
    const aw = ic.wrap(a);

    expect(getUnProxyTarget(aw)).toBe(a);
    expect(getClassMethodParams(aw, 'run')).toHaveLength(1);

  });

  it('should support no proxy access', async () => {

    class A {
      @disableProxy
      run(@inject("a") a) {
        return a;
      }
    }

    const a = new A();
    const ic = InjectContainer.New();
    ic.registerInstance("a", 1);
    const aw = ic.wrap(a);
    expect(await aw.run()).toBeUndefined();

  });

  it('should return it self scenarios', async () => {

    const ic = InjectContainer.New();

    const p = Promise.resolve(1);

    // no wrap for inject container
    expect(ic.wrap(ic)).toBe(ic);

    // no wrap for promise object
    expect(ic.wrap(p)).toBe(p);


  });

});