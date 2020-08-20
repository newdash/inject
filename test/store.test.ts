// @ts-nocheck
import { inject, InjectContainer, transientClass } from "../src";

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
    @transientClass
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

});