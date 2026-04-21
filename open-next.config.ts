import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Default config: no ISR/R2 cache, no Workers KV, no tagging. Revisit when
// incremental static regeneration or image optimization need Cloudflare
// storage backends.
export default defineCloudflareConfig({});
