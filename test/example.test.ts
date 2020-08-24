import { inject, InjectContainer, InjectWrappedInstance, provider, transient } from "../src";


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

    // alias to register simple instance
    ic.registerInstance("v", 42);

    // create an instance of 'B", 
    // also, an instance of 'A' will be created,
    // because it's the dependency of 'B'.
    const b = await ic.getWrappedInstance(B);

    expect(await b.getValue()).toBe(84);


  });

  it('should support inject instance provider', async () => {

    class P1 {
      private idx = 0
      @inject("count")
      count: number
      @provider("v")
      provide() {
        this.idx++;
        return this.count + this.idx;
      }
    }

    class P2 {
      private idx = 0
      @inject("count")
      count: number
      @transient
      @provider("v2") // transient provider
      provide() {
        this.idx++;
        return this.count + this.idx;
      }
    }

    const ic = InjectContainer.New();
    ic.registerInstance("count", 15);
    ic.registerProvider(P1);
    ic.registerProvider(P2);


    expect(await ic.getInstance("v")).toBe(16);
    // value will be cached
    expect(await ic.getInstance("v")).toBe(16);

    expect(await ic.getInstance("v2")).toBe(16);
    // value will NOT be cached
    expect(await ic.getInstance("v2")).toBe(17);

  });

});