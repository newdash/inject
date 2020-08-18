import { v4 } from 'uuid';
import { createInstanceProvider, inject, InjectContainer, InstanceProvider, LazyRef } from '../src';


describe('Inject Provider Test Suite', () => {


  it('should support create class without provider', async () => {

    class A {

    }

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

    const c = await container.getInstance(C);
    const d = await container.getInstance(D);

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

    expect(i.ctx.getParent()).toBe(container);

  });

  it('should support provide sub class instance', async () => {

    class A {

    }

    class B extends A {

    }

    class C extends B {

    }

    const container = new InjectContainer();
    container.registerProvider(createInstanceProvider(C, new C()));
    const a = await container.getInstance(A);
    const b = await container.getInstance(B);


    expect(a).toBeInstanceOf(C);
    expect(b).toBeInstanceOf(C);
    expect(b).toBe(a);

  });


});
