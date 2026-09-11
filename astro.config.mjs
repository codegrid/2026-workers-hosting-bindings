// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare({
    // 開発サーバーでも、RPCの呼び出し先であるWorkerを一緒に起動する
    auxiliaryWorkers: [{ configPath: './workers/review-processor/wrangler.jsonc' }],
  }),
});
