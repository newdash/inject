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

// async runner
it('should works', async () => {

  const ic = InjectContainer.New();

  class A {
    getValue(@inject("v") v: number): number {
      return v;
    }
  }

  class B {

    // constructor inject
    constructor(@inject("v") v: number) {
      this.v = v;
    }

    // injected property 
    @inject(A)
    a: InjectWrappedInstance<A>
    // normal property
    v: number

    async getValue() {
      // after inject, all methods of the 'A' instance will be wrapped, and become 'async' methods
      return this.v + await this.a.getValue();
    }

  }
  // alias to register simple instance provider
  ic.registerInstance("v", 42); 

  // create an instance of 'B", 
  // also, an instance of 'A' will be created,
  // because it's the dependency of 'B'.
  const b = await ic.getWrappedInstance(B);

  expect(await b.getValue()).toBe(84);


});
```

## [CHANGELOG](./CHANGELOG.md)

## [LICENSE](./LICENSE)