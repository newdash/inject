# NewDash - Dependency Inject Container

[![npm (scoped)](https://img.shields.io/npm/v/@newdash/inject?label=@newdash/inject)](https://www.npmjs.com/package/@newdash/inject)
[![Codecov](https://codecov.io/gh/newdash/inject/branch/master/graph/badge.svg)](https://codecov.io/gh/newdash/inject)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=newdash_inject&metric=alert_status)](https://sonarcloud.io/dashboard?id=newdash_inject)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=newdash_inject&metric=security_rating)](https://sonarcloud.io/dashboard?id=newdash_inject)

Yet another `dependency injection` container

## Quick Start


```ts
class B {
  _id: string
  constructor(@inject('id') id) {
    this._id = id;
  }
}
const testUUID = v4();
const container = new InjectContainer();
class IDProvider implements InstanceProvider {
  type = 'id';
  async provide() {
    return testUUID;
  }
}
container.registerProvider(new IDProvider());
const b = await container.getInstance(B);
expect(b._id).toBe(testUUID);
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

## [CHANGELOG](./CHANGELOG.md)

## [LICENSE](./LICENSE)