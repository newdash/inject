import { v4 } from 'uuid';
import { createInstanceProvider, inject, InjectContainer, InjectWrappedInstance, InstanceProvider, LazyRef, noWrap, provider, transient } from '../src';
import { MSG_ERR_NOT_PROVIDER, MSG_ERR_NO_UNDEFINED } from '../src/constants';


describe('Inject Provider Test Suite', () => {

  it('should support create class without provider', async () => {

    class A { }

    const container = InjectContainer.New();

    expect(await container.getInstance(A)).toBeInstanceOf(A);

  });

  it('should throw error when not a valid accepted provider', () => {

    const ic = InjectContainer.New();

    class A { }

    // @ts-ignore
    expect(() => ic.registerProvider(A)).toThrow(MSG_ERR_NOT_PROVIDER);
    // @ts-ignore
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
    container.doNotWrap(C, D);

    const d = await container.getInstance(D);
    const c = await container.getInstance(C);

    expect(c._d).not.toBeUndefined();
    expect(c._d).toBe(d);

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

  it('should support cycle inject itself', async () => {

    class A { @noWrap @inject() a: A }

    const ic = InjectContainer.New();

    const a = await ic.getInstance(A);

    expect(a.a).toBe(a);

  });

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

  it('should support get instance by provider class', async () => {

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

  it('should support lazy ref provider inject', async () => {

    class BProvider {

      @provider(LazyRef.create(() => B))
      async provide() {
        const rt = new B;
        rt.v = 123;
        return rt;
      }

    }

    class B {
      v: number
    }

    const ic = InjectContainer.New();
    ic.registerProvider(BProvider);

    const b = await ic.getInstance(B);
    expect(b).not.toBeUndefined();
    expect(b.v).toBe(123);



  });

  it('should support register multi providers by `injectContainer.registerProvider`', async () => {
    const ic = InjectContainer.New();

    class PV1 {
      @provider("v1")
      provide() { return 1; }
    }

    class PV2 {
      @provider("v2")
      provide() { return 2; }
    }

    ic.registerProvider(PV1, PV2);

    expect(await ic.getInstance("v1")).toBe(1);
    expect(await ic.getInstance("v2")).toBe(2);

  });

  it('should support deep constructor injection', async () => {

    class A {
      v: number
      constructor(@inject("v") v) {
        this.v = v;
      }
    }

    class B {
      a: InjectWrappedInstance<A>
      constructor(@inject(A) a) {
        this.a = a;
      }
    }

    const ic = InjectContainer.New();
    ic.registerInstance("v", 999);
    const b = await ic.getInstance(B);

    expect(b.a.v).toBe(999);

  });

  it('should support register provider by decorator', async () => {
    const ic = InjectContainer.New();

    // must bind `this`
    const registerProvider = ic.registerProvider.bind(ic);

    @registerProvider
    class VProvider {
      @provider("v")
      provide() { return 15; }
    }

    expect(await ic.getInstance("v")).toBe(15);

  });

  it('should only construct provide only once', async () => {

    let constructNum = 0;
    let funcCall = 0;

    class CProvider {
      constructor() {
        constructNum++;
      }
      @provider("c")
      provide() { funcCall++; return "CCC"; }
    }

    const ic = InjectContainer.New();
    ic.registerProvider(CProvider);

    await ic.getInstance("c");
    await ic.getInstance("c");
    await ic.getInstance("c");

    expect(constructNum).toBe(1);
    expect(funcCall).toBe(1);

  });

  it('should never cache @transient provider/value or both', async () => {

    let constructNum = 0;
    let funcCall = 0;

    @transient
    class AProvider {
      constructor() { constructNum++; }
      @provider("a")
      provide() { funcCall++; return "AAA"; }
    }

    @transient
    class BProvider {
      constructor() { constructNum++; }
      @transient
      @provider("b")
      provide() { funcCall++; return "BBB"; }
    }

    class CProvider {
      constructor() { constructNum++; }
      @transient
      @provider("c")
      provide() { funcCall++; return "CCC"; }
    }

    const ic = InjectContainer.New();
    ic.registerProvider(AProvider);
    ic.registerProvider(BProvider);
    ic.registerProvider(CProvider);

    await ic.getInstance("a");
    await ic.getInstance("a");
    await ic.getInstance("a");
    // provider will be instantiate every time
    expect(constructNum).toBe(3);
    // but value cached
    expect(funcCall).toBe(1);

    constructNum = funcCall = 0;
    await ic.getInstance("b");
    await ic.getInstance("b");
    await ic.getInstance("b");
    expect(constructNum).toBe(3);
    expect(funcCall).toBe(3);

    constructNum = funcCall = 0;
    await ic.getInstance("c");
    await ic.getInstance("c");
    await ic.getInstance("c");
    expect(constructNum).toBe(1);
    expect(funcCall).toBe(3);

  });


  it('should reject "undefined" provider', () => {

    const ic = InjectContainer.New();

    expect((() => ic.registerProvider(undefined))).toThrow(MSG_ERR_NO_UNDEFINED);
    expect((() => ic.registerProvider(null))).toThrow(MSG_ERR_NO_UNDEFINED);

    expect((() => ic.registerInstance(undefined, "1"))).toThrow(MSG_ERR_NOT_PROVIDER);


  });



});
