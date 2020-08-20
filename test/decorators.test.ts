import { Server } from 'http';
import { DefaultClassProvider, getClassConstructorParams, getClassInjectionInformation, getPropertyInjectedType, getProvideInfo, getTransientInfo, inject, InjectContainer, isTransientClass, LazyRef, provider, transientClass } from '../src/index';

describe('Inject Decorators Test Suite', () => {

  it('should support use @inject parameters', () => {

    class A {

      @inject('userName')
      private _name: string;

      private _date: Date;

      @inject()
      private _value: Server;


      constructor(@inject(Date) date: Date) {
        this._date = date;
      }

      run(@inject('ctx') ctx, @inject(Date) date) {

      }

    }

    const constructParams = getClassConstructorParams(A);

    expect(constructParams).toHaveLength(1);
    expect(constructParams[0].type).toBe(Date);
    expect(constructParams[0].parameterIndex).toBe(0);

    const injections = getClassInjectionInformation(A.prototype);

    expect(injections.size).toBe(3);

    const methodRunInjection = injections.get('run');

    expect(methodRunInjection.injectType).toBe('classMethod');
    expect(methodRunInjection.parameters).toHaveLength(2);

    expect(methodRunInjection.parameters[0].type).toBe('ctx');
    expect(methodRunInjection.parameters[0].parameterIndex).toBe(0);
    expect(methodRunInjection.parameters[1].type).toBe(Date);
    expect(methodRunInjection.parameters[1].parameterIndex).toBe(1);

    const a = new A(new Date());

    expect(getPropertyInjectedType(a, "_name")).toBe("userName");

  });

  it('should support transient decorator', () => {


    @transientClass
    class A { }

    class B extends A { }

    expect(isTransientClass(A)).toBe(true);
    expect(isTransientClass(B)).toBe(false);

    expect(isTransientClass(null)).toBe(false);

  });

  it('should support @provider decorator', () => {

    @provider("v1")
    class A {

      @provider("v2")
      createV2() { }

      @provider("v3")
      static createV3() { }

      @provider("t", true)
      provideT() { }

      @provider(LazyRef.create(() => C), true)
      provideLazy() { }

    }

    class C { }

    const cp1 = new DefaultClassProvider(A, true, InjectContainer.New());

    // class type
    expect(getProvideInfo(A)).toBe("v1");
    // @ts-ignore
    expect(getProvideInfo((new A).constructor)).toBe("v1");
    // class method
    expect(getProvideInfo(new A, "createV2")).toBe("v2");
    // lazy ref
    expect(getProvideInfo(new A, "provideLazy")).toBe(C);
    // class static type
    expect(getProvideInfo(A, "createV3")).toBe("v3");
    expect(getTransientInfo(A, "createV3")).toBe(false);
    expect(getTransientInfo(new A, "provideT")).toBe(true);
    expect(getProvideInfo(cp1, "provide")).toBe(A);
    expect(getTransientInfo(cp1, "provide")).toBe(true);


  });


});
