import { GlobalContainer, inject, registerGlobal, withType } from "../src";



describe('Module Test Suite', () => {


  it('should support global container', async () => {

    class A { @inject("v") v: string; }

    class B { @inject() a: A }

    @registerGlobal
    class VProvider { @withType("v") provide() { return 'hello'; } }

    const b = await GlobalContainer.getInstance(B);

    expect(b.a.v).toBe("hello");

  });

});