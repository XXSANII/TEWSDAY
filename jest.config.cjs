module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/env.ts'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/modules/**/*.ts',
    'src/common/**/*.ts',
    'src/middleware/**/*.ts',
    'src/services/**/*.ts',
    'src/controllers/**/*.ts',
    'src/routes/**/*.ts',
    'src/repositories/**/*.ts',
    'src/utils/**/*.ts',
  ],
  coverageThreshold: { global: { lines: 80, statements: 80, functions: 80 } },
};
