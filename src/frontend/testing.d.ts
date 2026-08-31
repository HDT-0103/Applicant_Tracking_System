/// <reference types="@testing-library/jest-dom" />

// Teaches TypeScript about the jest-dom matchers (`toBeInTheDocument` and
// friends) that `vitest.setup.ts` registers at runtime. Without it the tests
// pass but `npm run typecheck` reports every matcher as missing, which would
// leave the typecheck permanently red and therefore ignored.
export {};
