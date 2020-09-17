import "reflect-metadata";
import { InjectContainer } from "./container";

const GlobalContainer = InjectContainer.New();

const registerGlobal = GlobalContainer.registerProvider.bind(GlobalContainer);

export * from './container';
export * from './decorators';
export * from './provider';
export { InjectWrappedInstance, OptionalConstructorParameters, OptionalParameters, PromiseConstructor } from "./utils";
export { GlobalContainer, registerGlobal };



