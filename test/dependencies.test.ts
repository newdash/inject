import { inject, InjectContainer, LazyRef } from '../src';


describe('Dependencies Check Suite', () => {

  it('should throw error when constructor has direct dependent with each other', async () => {

    class D1 {

      constructor(@inject(LazyRef.create(() => D2)) d2) {

      }
    }

    class D2 {
      constructor(@inject(LazyRef.create(() => D1)) d1) {

      }
    }

    const container = InjectContainer.New();

    await expect(() => container.getInstance(D2)).rejects.toThrow('found cycle dependencies in: D1, D2');

  });


  it('should throw error when provider has direct dependent with each other', async () => {


    class D1Provider {
      type = 'D1'
      async provide(@inject('D2') d2) { }
    }

    class D2Provider {
      type = 'D2'
      async provide(@inject('D1') d1) { }
    }

    const container = InjectContainer.New();

    container.registerProvider(new D1Provider);
    container.registerProvider(new D2Provider);

    await expect(() => container.getInstance('D2')).rejects.toThrow('found cycle dependencies in: D1, D2');
  });

});
