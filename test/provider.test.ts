import { v4 } from 'uuid';
import { createInstanceProvider, getUnProxyTarget, inject, InjectContainer, InstanceProvider, LazyRef, provider } from '../src';
import { MSG_ERR_NOT_PROVIDER } from '../src/constants';


describe('Inject Provider Test Suite', () => {

  it('should support create class without provider', async () => {

    class A { }

    const container = InjectContainer.New();

    expect(await container.getInstance(A)).toBeInstanceOf(A);

  });

  it('should raise error when not valid provider', () => {

    const ic = InjectContainer.New();

    class A { }

    expect(() => ic.registerProvider(A)).toThrow(MSG_ERR_NOT_PROVIDER);
    expect(() => ic.registerProvider(new A)).toThrow(MSG_ERR_NOT_PROVIDER);

  });

  it('should support create class instance with instance inject', async () => {

    class B {
      _id: string
      constructor(@inject('id') id) {
        this._id = id;
      }
    }

    const testUUID = v4();

    const container = InjectContainer.New();

    class IDProvider implements InstanceProvider {
      @provider("id")
      async provide() {
        return testUUID;
      }
    }

    container.registerProvider(new IDProvider());

    const b = await container.getInstance(B);

    expect(b._id).toBe(testUUID);


  });

  it('should support create class instance with class inject', async () => {

    class D { }

    class C {
      _d: D
      constructor(@inject(D) d) {
        this._d = d;
      }
    }

    const container = InjectContainer.New();

    const d = await container.getInstance(D);
    const c = await container.getInstance(C);

    expect(c._d).not.toBeUndefined();
    expect(getUnProxyTarget(c._d)).toBe(d);

  });

  it('should support cycle inject', async () => new Promise((resolve, reject) => {

    class E {
      @inject(LazyRef.create(() => F))
      _f: any
    }

    class F {
      @inject(LazyRef.create(() => E))
      _e: any
    }

    setTimeout(async () => {
      try {
        const container = InjectContainer.New();
        container.doNotWrap(E, F);
        const e = await container.getInstance(E);
        expect(e._f._e).toBe(e);
        resolve();
      } catch (error) {
        reject(error);
      }

    }, 0);
  }));

  it('should support creation instance provider', async () => {

    const uuid = v4();

    class G {

      @inject('value')
      value: any

    }

    const container = InjectContainer.New();

    container.registerProvider(createInstanceProvider('value', uuid));
    const g = await container.getInstance(G);

    expect(g.value).toBe(uuid);

  });

  it('should support inject the provider.provide function', async () => {

    const uuid = v4();

    class H {
      @inject('value')
      value: any
    }

    const container = InjectContainer.New();

    container.registerProvider(createInstanceProvider('uuid', uuid));

    class P1 implements InstanceProvider {
      @provider("value")
      async provide(@inject('uuid') uuid) { return uuid; }
    }

    container.registerProvider(new P1);

    const h = await container.getInstance(H);

    expect(h.value).toBe(uuid);

  });

  it('should support inject container itself', async () => {


    class I {

      @inject()
      ctx: InjectContainer

    }

    const container = InjectContainer.New();

    const i = await container.getInstance(I);

    expect(i.ctx.getParent().getParent()).toBe(container);

  });

  it('should support provide sub class instance', async () => {

    class A {
      v: string

      constructor() {
        this.v = 'a';
      }
    }

    class B extends A {
      constructor() {
        super();
        this.v = 'b';
      }
    }

    class C extends B {
      constructor() {
        super();
        this.v = 'c';
      }
    }

    class CInstanceProvider implements InstanceProvider {
      @provider(C)
      async provide() { return new C(); }
    }

    const container = InjectContainer.New();
    container.registerProvider(new CInstanceProvider);
    const a = await container.getInstance(A);
    const b = await container.getInstance(B);

    expect(a.v).toBe('c');

    expect(a).toBeInstanceOf(C);
    expect(b).toBeInstanceOf(C);
    expect(b).toBe(a);

    class BInstanceProvider implements InstanceProvider {
      @provider(B)
      async provide() { return new B(); }
    }

    container.registerProvider(new BInstanceProvider);

    // the instance of 'C' has been cached in container
    const c2 = await container.getInstance(B);
    expect(c2.v).toBe('c');


  });

  it('should support get provider instance', async () => {

    class VPlusProvider {
      type = 'v-plus'
      async provide(@inject("v") v: number) {
        return v + 1;
      }
    }

    const ic = InjectContainer.New();
    ic.registerInstance("v", 1);
    const vPlusProvider = await ic.getWrappedInstance(VPlusProvider);
    expect(await vPlusProvider.provide()).toBe(2);


  });

  it('should support get instance by un-instance provider', async () => {

    class VPlusProvider {

      @provider("v-plus")
      async provide(@inject("v") v: number) {
        return v + 1;
      }

    }

    const ic = InjectContainer.New();
    ic.registerInstance("v", 1);
    ic.registerProvider(VPlusProvider);
    expect(await ic.getInstance("v-plus")).toBe(2);

  });


});
