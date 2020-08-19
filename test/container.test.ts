import { v4 } from 'uuid';
import { createInstanceProvider, InjectContainer, InstanceProvider, SubLevelInjectContainer } from '../src';


describe('Container Test Suite', () => {

  it('should support sub level container', async () => {

    const c1 = InjectContainer.New();
    const c2 = await c1.createSubContainer();

    c1.registerProvider(createInstanceProvider('v1', 'v1'));
    c1.registerProvider(createInstanceProvider('v2', 'v3'));

    c2.registerProvider(createInstanceProvider('v1', 'v2'));

    const v1 = await c2.getInstance('v1');
    const v2 = await c2.getInstance('v2');

    expect(v1).toBe('v2');
    expect(v2).toBe('v3');

  });

  it('should get undefined value when not provided', async () => {

    const c = InjectContainer.New();
    expect(await c.getInstance("a")).toBeUndefined();

    // but NOT cache 'undefined' value
    c.registerInstance("a", 111);
    expect(await c.getInstance("a")).toBe(111);

  });

  it('should support transient providers', async () => {

    const c1 = InjectContainer.New();
    const c2 = await c1.getInstance(SubLevelInjectContainer);
    const c3 = await c1.getInstance(SubLevelInjectContainer);

    class UUIDProvider implements InstanceProvider {
      transient = true
      type = 'uuid'
      async provide() { return v4(); }
    }


    c1.registerProvider(createInstanceProvider('v1', '1'));
    c1.registerProvider(createInstanceProvider('v2', '2'));
    c1.registerProvider(new UUIDProvider);

    c2.registerProvider(createInstanceProvider('v1', '21'));
    c2.registerProvider(createInstanceProvider('vt2', '21', true));

    c3.registerInstance('v1', '31');
    c3.registerInstance('vt2', '31');


    // SubLevelInjectContainer is transient container,
    // each time will create new instance
    expect(c2).not.toBe(c3);
    // but parent container will be equal
    // @ts-ignore
    expect(c2._parent).toBe(c3._parent);

    expect(await c2.getInstance('v1')).toBe('21');
    expect(await c3.getInstance('v1')).toBe('31');

    expect(await c2.getInstance('v2')).toBe('2');
    expect(await c3.getInstance('v2')).toBe('2'); // sub level will get stored value from parent

    // transient 'vt2' value in 'c2'
    expect(await c2.getInstance('vt2')).toBe('21'); // transient provider will not store
    expect(await c3.getInstance('vt2')).toBe('31'); // and sub level will not get it


    expect(await c3.getInstance('uuid')).not.toBe(await c3.getInstance('uuid'));


  });

  it('should support deep container hierarchy', async () => {

    const c1 = InjectContainer.New();
    const c2 = await c1.getInstance(SubLevelInjectContainer);
    const c3 = await c2.getInstance(SubLevelInjectContainer);

    c1.registerProvider(createInstanceProvider('v1', '1'));
    c1.registerProvider(createInstanceProvider('v01', '01'));
    c1.registerProvider(createInstanceProvider('v11', '11'));

    c2.registerProvider(createInstanceProvider('v1', '2'));
    c2.registerProvider(createInstanceProvider('v11', '22'));
    c2.registerProvider(createInstanceProvider('v22', '22'));

    c3.registerProvider(createInstanceProvider('v1', '3'));

    expect(await c3.getInstance('v1')).toBe('3'); // from c3
    expect(await c3.getInstance('v22')).toBe('22'); // from c2
    expect(await c3.getInstance('v11')).toBe('22'); // from c2
    expect(await c3.getInstance('v01')).toBe('01'); // from c1

  });


});
