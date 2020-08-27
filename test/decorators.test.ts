import { Server } from 'http';
import { createInjectDecorator, DefaultClassProvider, getClassConstructorParams, getClassInjectionInformation, getNamespace, getPropertyInjectedType, getProvideInfo, getTransientInfo, inject, InjectContainer, isNoWrap, isNoWrapProvider, isRequired, isTransient, LazyRef, namespace, noWrap, provider, required, transient, withType } from '../src/index';

describe('Decorators Test Suite', () => {

  it('should support use @inject() with parameters', () => {

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

      run2(@inject('ctx') ctx, date, @inject("v") v) { }

    }

    const constructParams = getClassConstructorParams(A);

    expect(constructParams).toHaveLength(1);
    expect(constructParams[0].type).toBe(Date);
    expect(constructParams[0].parameterIndex).toBe(0);

    const injections = getClassInjectionInformation(A.prototype);

    expect(injections.size).toBe(4);

    const method_run_parameters = injections.get('run');
    expect(method_run_parameters.injectType).toBe('classMethod');
    expect(method_run_parameters.parameters).toHaveLength(2);
    expect(method_run_parameters.parameters[0].type).toBe('ctx');
    expect(method_run_parameters.parameters[0].parameterIndex).toBe(0);
    expect(method_run_parameters.parameters[1].type).toBe(Date);
    expect(method_run_parameters.parameters[1].parameterIndex).toBe(1);

    const method_run2_parameters = injections.get('run2');
    expect(method_run2_parameters.parameters).toHaveLength(3);
    expect(method_run2_parameters.parameters[0].type).toBe('ctx');
    expect(method_run2_parameters.parameters[0].parameterIndex).toBe(0);
    expect(method_run2_parameters.parameters[1]).toBeUndefined();
    expect(method_run2_parameters.parameters[2].type).toBe("v");
    expect(method_run2_parameters.parameters[2].parameterIndex).toBe(2);

    const a = new A(new Date());

    expect(getPropertyInjectedType(a, "_name")).toBe("userName");

  });

  it('should support @inject.param() decorator', async () => {


    class A {

      @inject("C") @inject.param("v", 245) a: A;

      @inject.param("v", 42) @inject("C") a2: A;

      run(@inject("C") @inject.param("v", 123) c) { }

      constructor(@inject("V") @inject.param("v", 1) v?, @inject("v2") v2?) { }

    }

    const a = new A;

    const constructor_param_0 = inject.getInjectParameter(A, undefined, 0);
    expect(constructor_param_0.v).toBe(1);

    const constructor_params = inject.getInjectParameter(A);
    expect(constructor_params).toHaveLength(2);
    expect(constructor_params[0]).toBe(constructor_param_0);
    expect(Object.keys(constructor_params[1])).toHaveLength(0);

    const method_run_param_0 = inject.getInjectParameter(a, "run", 0);
    expect(method_run_param_0.v).toBe(123);
    const method_run_params = inject.getInjectParameter(a, "run", {});
    expect(method_run_params).toHaveLength(1);

    const property_a_param = inject.getInjectParameter(a, "a");
    expect(property_a_param.v).toBe(245);
    const property_a2_param = inject.getInjectParameter(a, "a2");
    expect(property_a2_param.v).toBe(42);

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

  it('should support @noWrap for class & provider', () => {

    class A { }

    @noWrap
    class B { }

    class P {
      @noWrap
      @provider("p")
      provide(@noWrap a, b, c) { }
    }
    class P2 {
      @provider("p")
      provide() { }
    }

    class P3 {
      constructor(@noWrap a, b) { }
    }

    const aP = new DefaultClassProvider(A, undefined, InjectContainer.New());
    const bP = new DefaultClassProvider(B, undefined, InjectContainer.New());

    expect(isNoWrap(A)).toBeFalsy();
    expect(isNoWrap(B)).toBeTruthy();

    const p = new P;

    expect(isNoWrap(p, 'provide', 0)).toBeTruthy();
    expect(isNoWrap(p, 'provide', 1)).toBeFalsy();
    expect(isNoWrap(p, 'provide', 2)).toBeFalsy();

    expect(isNoWrap(P3, undefined, 0)).toBeTruthy();
    expect(isNoWrap(P3, undefined, 1)).toBeFalsy();


    expect(isNoWrapProvider(P)).toBeTruthy();
    expect(isNoWrapProvider(P2)).toBeFalsy();
    expect(isNoWrapProvider(new P)).toBeTruthy();
    expect(isNoWrapProvider(new P2)).toBeFalsy();

    expect(isNoWrapProvider(bP)).toBeTruthy();
    expect(isNoWrapProvider(aP)).toBeFalsy();


  });



});
