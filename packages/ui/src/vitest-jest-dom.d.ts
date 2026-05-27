// Brings the @testing-library/jest-dom matcher augmentation (toBeInTheDocument,
// toHaveClass, …) into scope for `tsc` when it type-checks the test files under
// src/. At runtime the same import lives in test/setup.ts; this file exists only
// so the type augmentation is visible to the typecheck (test/ is outside include).
import "@testing-library/jest-dom/vitest";
