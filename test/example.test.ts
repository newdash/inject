import { inject, InjectContainer, InjectWrappedInstance } from "../src";


describe('Example Test Suite', () => {

  it('should works', async () => {

    const ic = InjectContainer.New();

    class A {
      getValue(@inject("v") v: number): number {
        return v;
      }
    }

    class B {

      // constructor inject
      constructor(@inject("v") v: number) {
        this.v = v;
      }

      // injected property 
      @inject(A)
      a: InjectWrappedInstance<A>
      // normal property
      v: number

      async getValue() {
        // after inject, all methods of the 'A' instance will be wrapped, and become 'async' methods
        return this.v + await this.a.getValue();
      }

    }

    // alias to register simple instance provider
    ic.registerInstance("v", 42);

    // create an instance of 'B", 
    // also, an instance of 'A' will be created,
    // because it's the dependency of 'B'.
    const b = await ic.getWrappedInstance(B);

    expect(await b.getValue()).toBe(84);


  });

});