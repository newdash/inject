import { Server } from 'http';
import { createInjectDecorator, DefaultClassProvider, getClassConstructorParams, getClassInjectionInformation, getNamespace, getPropertyInjectedType, getProvideInfo, getTransientInfo, inject, InjectContainer, isRequired, isTransient, LazyRef, namespace, provider, required, transient, withType } from '../src/index';

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

      run(@inject('ctx') ctx, @inject(Date) date) { }

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


    @transient
    class A { }

    class B extends A { }

    expect(isTransient(A)).toBe(true);
    expect(isTransient(B)).toBe(false);

    expect(isTransient(null)).toBe(false);

  });

  it('should support @provider decorator', () => {

    @provider("v1")
    class A {

      @provider("v2")
      createV2() { }

      @provider("v3")
      static createV3() { }

      @transient
      @provider("t")
      provideT() { }

      @transient
      @provider(LazyRef.create(() => C))
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

  it('should support create alias for specific type', async () => {

    const ic = InjectContainer.New();
    const injectV = createInjectDecorator("v");

    class C {
      @injectV
      v: number
    }

    ic.registerInstance("v", 123);
    const c = await ic.getInstance(C);

    expect(c.v).toBe(123);
  });

  it('should support namespace', () => {


    @namespace("inject.test.demo1")
    class A { }
    class B { }

    @namespace("inject.test.demo2")
    class C {
      a = 1
    }

    expect(getNamespace(A)).toBe("inject.test.demo1");
    expect(getNamespace(B)).toBe("");

    // get namespace for instance
    expect(getNamespace((new C))).toBe("inject.test.demo2");

  });

  it('should support create decorator for provider', () => {

    class VProvider { @withType("v") provide() { } }

    const injectV = createInjectDecorator(VProvider);

    class A {
      constructor(@injectV v) { }
    }

    const params = getClassConstructorParams(A);

    expect(params).toHaveLength(1);
    expect(params[0].type).toBe("v");

  });

  it('should support @required decorator', () => {

    class A {
      @required
      a: any
      f(@required v: any) { }

      constructor(@required v?) { }
    }

    const a = new A;

    expect(isRequired(a, "a")).toBeTruthy();
    expect(isRequired(a, "f", 0)).toBeTruthy();
    expect(isRequired(A, undefined, 0)).toBeTruthy();



  });



});
