import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // TensorFlow.js is ~1 MB gzipped — raise the warning threshold accordingly.
    chunkSizeWarningLimit: 1600,
  },
})
