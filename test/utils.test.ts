import { getClassName, getOrDefault } from "../src/utils";


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

    expect(getClassName("Object")).toBe("String");


  });

});
