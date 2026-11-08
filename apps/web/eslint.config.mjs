import { baseConfig } from '@revn/config/eslint/base.mjs';
import nextConfig from 'eslint-config-next';

const config = [
  ...baseConfig,
  ...nextConfig,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];

export default config;
