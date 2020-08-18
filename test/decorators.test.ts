import { Server } from 'http';
import { getClassConstructorParams, getClassInjectionInformation, inject, isTransient, transient } from '../src/index';

describe('Inject Decorators Test Suite', () => {


  it('should support use @inject parameters', () => {

    class A {

      @inject('userName')
      private _name: string;

      private _date: Date;

      @inject()
      private _value: Server;


      constructor(@inject(Date) date: Date) {
        this._date = date;
      }

      run(@inject('ctx') ctx, @inject(Date) date) {

      }

    }

    const constructParams = getClassConstructorParams(A);

    expect(constructParams).toHaveLength(1);
    expect(constructParams[0].type).toBe(Date);
    expect(constructParams[0].parameterIndex).toBe(0);

    const injections = getClassInjectionInformation(A.prototype);

    expect(injections.size).toBe(3);

    const methodRunInjection = injections.get('run');

    expect(methodRunInjection.injectType).toBe('classMethod');
    expect(methodRunInjection.parameters).toHaveLength(2);

    expect(methodRunInjection.parameters[0].type).toBe('ctx');
    expect(methodRunInjection.parameters[0].parameterIndex).toBe(0);
    expect(methodRunInjection.parameters[1].type).toBe(Date);
    expect(methodRunInjection.parameters[1].parameterIndex).toBe(1);


  });

  it('should support transient decorator', () => {


    @transient
    class A { }

    class B extends A { }

    expect(isTransient(A)).toBe(true);
    expect(isTransient(B)).toBe(false);


  });

});
