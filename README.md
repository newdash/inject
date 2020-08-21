# NewDash - Dependency Inject Container

[![npm (scoped)](https://img.shields.io/npm/v/@newdash/inject?label=@newdash/inject)](https://www.npmjs.com/package/@newdash/inject)
[![Codecov](https://codecov.io/gh/newdash/inject/branch/master/graph/badge.svg)](https://codecov.io/gh/newdash/inject)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=newdash_inject&metric=alert_status)](https://sonarcloud.io/dashboard?id=newdash_inject)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=newdash_inject&metric=security_rating)](https://sonarcloud.io/dashboard?id=newdash_inject)

Yet another `dependency injection` container for `typescript`

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
// import reflect lib firstly
import "reflect-metadata"; 
import { inject } from "@newdash/inject"

// a really simple example
it('should support deep constructor injection', async () => {

  class A {
    v: number
    constructor(@inject("v") v) {
      this.v = v;
    }
  }

  class B {
    a: InjectWrappedInstance<A>
    constructor(@inject(A) a) {
      this.a = a;
    }
  }

  const ic = InjectContainer.New();
  ic.registerInstance("v", 999); // define an instance provider in simple way
  const b = await ic.getInstance(B);
  expect(b.a.v).toBe(999);

});
```

## [CHANGELOG](./CHANGELOG.md)

## [LICENSE](./LICENSE)