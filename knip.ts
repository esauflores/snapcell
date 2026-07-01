import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/extension.ts'],
  project: ['src/**/*.ts'],
  ignore: ['out/**', 'node_modules/**', 'tests/**'],
  ignoreDependencies: ['@types/vscode'],
  oxlint: {
    config: '.oxlintrc.json',
  },
  oxfmt: {
    config: '.oxfmtrc.jsonc',
  },
};

export default config;
