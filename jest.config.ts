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
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@connectors/(.*)$': '<rootDir>/src/connectors/$1',
    '^@schemas/(.*)$': '<rootDir>/src/schemas/$1',
    '^@tools/(.*)$': '<rootDir>/src/tools/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};

export default config;