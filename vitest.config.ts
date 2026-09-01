import fs from 'node:fs'

import { defineConfig } from 'vitest/config'

const envFile = new URL('.env', import.meta.url)
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile)
}

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false
  }
})
