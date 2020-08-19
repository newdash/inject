import { getOrDefault } from "../src/utils";


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

});
