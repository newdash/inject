import { v4 } from 'uuid';
import { createInstanceProvider, inject, InjectContainer, InstanceProvider, LazyRef } from '../src';


describe('Inject Provider Test Suite', () => {

  it('should support create class without provider', async () => {

    class A { }

    const container = new InjectContainer();

    expect(await container.getInstance(A)).toBeInstanceOf(A);

  });

  it('should support create class instance with instance inject', async () => {

    class B {
      _id: string
      constructor(@inject('id') id) {
        this._id = id;
      }
    }

    const testUUID = v4();

    const container = new InjectContainer();

    class IDProvider implements InstanceProvider {
      type = 'id';
      async provide() {
        return testUUID;
      }
    }

    container.registerProvider(new IDProvider());

    const b = await container.getInstance(B);

    expect(b._id).toBe(testUUID);


  });

  it('should support create class instance with class inject', async () => {

    class D {

    }

    class C {
      _d: D
      constructor(@inject(D) d) {
        this._d = d;
      }
    }

    const container = new InjectContainer();

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
        const container = new InjectContainer();
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

    const container = new InjectContainer();

    container.registerProvider(createInstanceProvider('value', uuid));
    const g = await container.getInstance(G);

    expect(g.value).toBe(uuid);

  });

  it('should support inject provider provider function', async () => {

    const uuid = v4();

    class H {

      @inject('value')
      value: any

    }

    const container = new InjectContainer();

    container.registerProvider(createInstanceProvider('uuid', uuid));

    class P1 implements InstanceProvider {
      type = 'value'
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

    const container = new InjectContainer();

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
      type = C
      transient = false;
      share = true;
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
      type = B
      transient = false;
      share = true;
      async provide() { return new B(); }
    }

    container.registerProvider(new BInstanceProvider);

    // the instance of 'C' has been cached in container
    const c2 = await container.getInstance(B);
    expect(c2.v).toBe('c');


  });


});
