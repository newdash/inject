# NewDash - Dependency Inject Container

[![npm (scoped)](https://img.shields.io/npm/v/@newdash/inject?label=@newdash/inject)](https://www.npmjs.com/package/@newdash/inject)
[![Codecov](https://codecov.io/gh/newdash/inject/branch/master/graph/badge.svg)](https://codecov.io/gh/newdash/inject)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=newdash_inject&metric=alert_status)](https://sonarcloud.io/dashboard?id=newdash_inject)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=newdash_inject&metric=security_rating)](https://sonarcloud.io/dashboard?id=newdash_inject)

Yet another `dependency injection` container

## Quick Start

```bash
# install libs
npm i -S reflect-metadata @newdash/inject
```

```json
// tsconfig.json
// remember enable decorator related flags
{
  "compilerOptions": {
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  }
}
```

```ts
import "reflect-metadata"; // import reflect lib
import { inject } from "@newdash/inject"

// async runner
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

## Instance Wrapper (Dynamic Proxy)

```ts
it('should support wrapper of instance', async () => {

  class Base {
    sub(@inject('v1') v1: number, @inject('v2') v2: number): number {
      return v1 - v2;
    }
  }

  class A extends Base {
    sum(@inject('v1') v1: number, @inject('v2') v2: number): number {
      return v1 + v2;
    }
    async _getV1(@inject('v1') v1?: number) {
      return v1;
    }
    async _getV2(@inject('v2') v2?: number) {
      return v2;
    }
    async _getSum(): Promise<number> {
      return (await this._getV1()) + (await this._getV2());
    }
  }

  const c = InjectContainer.New();
  c.registerInstance('v1', 1);
  c.registerInstance('v2', 2);

  const aw = await c.getWrappedInstance(A);

  // all function will be transformed to 'async' function
  expect(await aw.sum()).toBe(3); // injected (1) + injected (2)
  expect(await aw.sub()).toBe(-1); // injected (1) - injected (2)
  expect(await aw.sum(15)).toBe(17); // 15 + injected (2)
  expect(await aw.sub(15)).toBe(13); // 15 - injected (2)
  expect(await aw.sum(undefined, 99)).toBe(100); // injected (1) + 99
  expect(await aw.sub(undefined, 99)).toBe(-98); // injected (1) - 99

  // even no parameter given, and no parameters given to '_getSum' function
  // the 'this' object is replaced with a dynamic proxy
  // and 'inject container' will automatic fullfil the `undefined` values
  expect(await aw._getSum()).toBe(3);

});
```

## [CHANGELOG](./CHANGELOG.md)

## [LICENSE](./LICENSE)