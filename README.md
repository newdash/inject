# NewDash - Dependency Inject Container

[![npm (scoped)](https://img.shields.io/npm/v/@newdash/inject?label=@newdash/inject)](https://www.npmjs.com/package/@newdash/inject)
[![Codecov](https://codecov.io/gh/newdash/inject/branch/master/graph/badge.svg)](https://codecov.io/gh/newdash/inject)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=newdash_inject&metric=alert_status)](https://sonarcloud.io/dashboard?id=newdash_inject)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=newdash_inject&metric=security_rating)](https://sonarcloud.io/dashboard?id=newdash_inject)

Yet another `dependency injection` container

## Quick Start


```ts
it('should support sub level container', async () => {

  const c1 = new InjectContainer();
  const c2 = await c1.createSubContainer();

  c1.registerProvider(createInstanceProvider('v1', 'v1'));
  c1.registerProvider(createInstanceProvider('v2', 'v3'));
  c2.registerProvider(createInstanceProvider('v1', 'v2'));

  const v1 = await c2.getInstance('v1');
  const v2 = await c2.getInstance('v2');

  expect(v1).toBe('v2');
  expect(v2).toBe('v3');

});
```

## Automatic ByDefault Class Construction

```ts
it('should support create class instance with class inject', async () => {
  class D {
  }
  class C {
    _d: D
    constructor(@inject(D) d) {
      this._d = d;
    }
  }
  const container = new InjectContainer();
  const c = await container.getInstance(C);
  const d = await container.getInstance(D);
  expect(c._d).not.toBeUndefined();
  expect(c._d).toBe(d);
});
```


## Circular Injection

```ts
it('should support cycle inject', async () => new Promise((resolve, reject) => {

  class E {
    @inject(LazyRef.create(() => F))
    _f: any
  }

  class F {
    @inject(LazyRef.create(() => E))
    _e: any
  }

  setTimeout(async () => {
    try {
      const container = new InjectContainer();
      const e = await container.getInstance(E);
      expect(e._f._e).toBe(e);
      resolve();
    } catch (error) {
      reject(error);
    }

  }, 0);

}));
```

## Parent-Sub Class Injection

```ts
it('should support provide sub class instance', async () => {
  class A { }
  class B extends A { }
  class C extends B { }

  const container = new InjectContainer();
  container.registerProvider(
    createInstanceProvider(C, new C())
  );
  const a = await container.getInstance(A);
  const b = await container.getInstance(B);

  expect(a).toBeInstanceOf(C);
  expect(b).toBeInstanceOf(C);
  expect(b).toBe(a);
});
```

## [CHANGELOG](./CHANGELOG.md)

## [LICENSE](./LICENSE)