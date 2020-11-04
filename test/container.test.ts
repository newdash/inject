import { v4 } from 'uuid';
import { ChildInjectContainer, createInstanceProvider, inject, InjectContainer, noWrap, provider, required, transient, withType } from '../src';
import { RequiredNotFoundError } from '../src/errors';


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
    const c2 = await c1.createSubContainer();
    const c3 = await c1.createSubContainer();

    class UUIDProvider {
      @transient
      @provider("uuid")
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
    const c2 = await c1.getInstance(ChildInjectContainer);
    const c3 = await c2.getInstance(ChildInjectContainer);

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

  it('should throw error when can not provide value for @required value', async () => {

    const ic = InjectContainer.New();

    class A {
      @required
      @inject("v")
      aV: string;
    }

    class B {
      constructor(@required @inject("v") bV?) { }
    }

    class C {
      run(@required @inject("v") cV: any) {
        return cV;
      }
    }

    class D {
      static run(@required @inject("v") dV: any) { }
    }

    expect(() => ic.getInstance(A)).rejects.toThrow(RequiredNotFoundError);
    expect(() => ic.getInstance(B)).rejects.toThrow(RequiredNotFoundError);
    expect(async () => { const c = await ic.getWrappedInstance(C); return c.run(); }).rejects.toThrow(RequiredNotFoundError);
    expect(async () => { const d = await ic.wrap(D); return d.run(); }).rejects.toThrow(RequiredNotFoundError);

  });

  it('should support inject @inject.param() parameters', async () => {

    @transient
    class A { @inject("a") a: number }

    class B { @inject.param("a", 1) @noWrap @inject(A) a: A }

    class C {
      a: A
      constructor(@inject.param("a", 42) @noWrap @inject(A) a: A) { this.a = a; }
    }

    class AnswerProvider {
      // please use @transient to avoid container cache value result
      @transient
      @withType("answer")
      provide(@inject("base") @noWrap base: number) { return base + 41; }
    }

    class E {
      @inject.param("base", 1) @inject("answer")
      theRealAnswer: number;
      @inject.param("base", 99) @inject("answer")
      anotherAnswer: number;
    }

    class F {
      getAnswer(@inject.param("base", 42) @inject("answer") answer) {
        return answer;
      }
    }

    const ic = InjectContainer.New();

    const b = await ic.getInstance(B);
    // @ts-ignore
    expect(ic._providers.size).toBe(0);
    expect(b.a.a).toBe(1);

    const c = await ic.getInstance(C);
    expect(c.a.a).toBe(42);

    ic.registerProvider(AnswerProvider);
    const e = await ic.getInstance(E);
    expect(e.theRealAnswer).toBe(42);
    expect(e.anotherAnswer).toBe(140);

    const f = await ic.getWrappedInstance(F);
    expect(await f.getAnswer()).toBe(83);


  });

  it('should support container.getRoot function', async () => {
    const ic = InjectContainer.New();
    const i1 = await ic.createSubContainer();
    const i2 = await ic.createSubContainer();
    const i11 = await ic.createSubContainer();
    const i111 = await ic.createSubContainer();

    const root = ic.getParent();

    expect(ic.getRoot()).toBe(root);
    expect(i1.getRoot()).toBe(root);
    expect(i2.getRoot()).toBe(root);
    expect(i11.getRoot()).toBe(root);
    expect(i111.getRoot()).toBe(root);

  });

});
