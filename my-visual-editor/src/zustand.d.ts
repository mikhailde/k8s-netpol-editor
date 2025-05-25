import 'zustand';

declare module 'zustand' {
  export interface UseBoundStore<S extends import('zustand/vanilla').StoreApi<unknown>> {
    <U>(
      selector: (state: S extends { getState: () => infer T } ? T : never) => U,
      equalityFn?: (a: U, b: U) => boolean
    ): U;
  }
}
