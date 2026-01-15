import "@testing-library/jest-dom";
import { vi } from "vitest";

// Provide a Jest-compatible global for tests that were authored with Jest APIs
// Map commonly used functions to Vitest equivalents
const jestLike: any = vi;
jestLike.fn = vi.fn;
jestLike.spyOn = vi.spyOn;
// Enhance mock() to auto-create function mocks when no factory is provided,
// so imports like `jest.mock('./useAgeAdaptive')` yield functions with mockReturnValue
jestLike.mock = ((id: string, factory?: any) => {
  if (factory) return vi.mock(id, factory);
  return vi.mock(id, () => {
    return new Proxy(
      {},
      {
        get: (_target, _prop) => vi.fn(),
      }
    ) as any;
  });
}) as unknown as typeof vi.mock;
jestLike.resetAllMocks = vi.resetAllMocks;
jestLike.clearAllMocks = vi.clearAllMocks;
jestLike.useFakeTimers = vi.useFakeTimers;
jestLike.useRealTimers = vi.useRealTimers;
(globalThis as any).jest = jestLike;
