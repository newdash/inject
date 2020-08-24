// @ts-nocheck
import { inject, InjectContainer, isWrappedObject, provider, transient } from "../src";

describe('Storage Policy Test Suite', () => {

  it('should cache instance when deep automatic create class instance', async () => {

    class A { }
    class B { @inject() a: A }
    class C { @inject() b: B }

    const ic = InjectContainer.New();
    ic.doNotWrap(A, B, C);

    const c = await ic.getInstance(C);
    const b = await ic.getInstance(B);
    const a = await ic.getInstance(A);

    expect(ic._store.size).toBe(3);


    expect(c.b).toBe(b);
    expect(c.b.a).toBe(a);
    expect(b.a).toBe(a);


  });

  it('should not cache instance which is transient', async () => {

    class A { }
    @transient
    class B { @inject() a: A }
    class C { @inject() b: B }

    const ic = InjectContainer.New();
    ic.doNotWrap(A, B, C);

    const c = await ic.getInstance(C);
    const b = await ic.getInstance(B);
    const a = await ic.getInstance(A);

    expect(ic._store.size).toBe(2);

    // 'B' will not be cached
    expect(c.b).not.toBe(b);

    // but 'A' will
    expect(c.b.a).toBe(b.a);
    expect(c.b.a).toBe(a);
    expect(b.a).toBe(a);

  });

  it('should not store wrapped object', async () => {

    class A {

      @inject("v")
      v: number;
    }

    class B {

      @inject()
      a: A

      @inject('c')
      c: string

    }

    class CProvider {
      @provider("c")
      provide() {
        return 'ccc';
      }
    }

    const ic = InjectContainer.New();
    ic.registerInstance("v", 1);
    ic.registerProvider(CProvider);

    const b = await ic.getWrappedInstance(B);
    expect(b.a.v).toBe(1);

    ic._store.forEach(value => {
      expect(isWrappedObject(value)).toBeFalsy();
    });

  });

});