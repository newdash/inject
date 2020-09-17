import { InjectContainer } from "./container";

/**
 * global container, each process will only have one instance
 */
export const GlobalContainer = InjectContainer.New();

/**
 * register provider for the GlobalContainer
 */
export const registerGlobal = GlobalContainer.registerProvider.bind(GlobalContainer);