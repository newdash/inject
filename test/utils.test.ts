// @ts-nocheck
import { getClassName, getOrDefault, isClass, isClassDecorator, isClassMethodDecorator, isClassMethodParameterDecorator, isClassPropertyDecorator, isClassStaticMethodDecorator, isClassStaticPropertyDecorator } from "../src/utils";


describe('Utilities Test Suite', () => {

  it('should get or default', () => {

    const m = new Map();
    const k = 'testid';
    const v = 'testvalue';
    const v2 = 'testvalue2';

    expect(getOrDefault(m, k, v)).toBe(v);
    expect(getOrDefault(m, k, v2)).toBe(v);


    expect(m.size).toBe(1);
    expect(m.get(k)).toBe(v);


  });

  it('should support getClassName', () => {

    class A { }

    const a = new A;

    expect(getClassName(A)).toBe("A");
    expect(getClassName(a)).toBe("A");

    expect(getClassName(null)).toBeUndefined();
    expect(getClassName(undefined)).toBeUndefined();

  });

  it('should support isClass check', () => {

    class A { }
    class B extends A { }
    class C123123$ { }
    class D1231248$ extends C123123$ { }

    const f1 = () => { };
    function f2() { }

    expect(isClass(A)).toBeTruthy();
    expect(isClass(B)).toBeTruthy();
    expect(isClass(C123123$)).toBeTruthy();
    expect(isClass(D1231248$)).toBeTruthy();

    expect(isClass(f1)).toBeFalsy();
    expect(isClass(f2)).toBeFalsy();

  });

  it('should support decorator checker', () => {

    let tmp = undefined;
    function dec(target, targetKey?, paramOrDesc?) {
      tmp = [target, targetKey, paramOrDesc];
    }

    @dec
    class A { }
    expect(isClassDecorator(...tmp)).toBeTruthy();

    class B { @dec a: number }
    expect(isClassPropertyDecorator(...tmp)).toBeTruthy();
    expect(isClassMethodDecorator(...tmp)).toBeFalsy();

    class C { @dec run() { } }
    expect(isClassMethodDecorator(...tmp)).toBeTruthy();
    expect(isClassPropertyDecorator(...tmp)).toBeFalsy();

    class D { run(@dec a?) { } }
    expect(isClassMethodParameterDecorator(...tmp)).toBeTruthy();

    class E { @dec static a }
    expect(isClassStaticPropertyDecorator(...tmp)).toBeTruthy();
    expect(isClassStaticMethodDecorator(...tmp)).toBeFalsy();

    class F { @dec static a() { } }
    expect(isClassStaticMethodDecorator(...tmp)).toBeTruthy();
    expect(isClassStaticPropertyDecorator(...tmp)).toBeFalsy();


  });

});
