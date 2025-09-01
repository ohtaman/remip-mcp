import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.ts'
  ],
  moduleFileExtensions: [
    'ts',
    'js',
    'json',
    'node'
  ],
  moduleNameMapper: {
    '^(\.{1,2}/.*)\.js$': '$1',
  },
};

export default config;
