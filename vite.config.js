import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../themes/bufoindex/static/js/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'src/main.js',
        'retirement-app': 'src/tools/retirement/app.js',
        'rent-buy-app': 'src/tools/rent-buy/app.js'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      // Proxy Hugo dev server for seamless development
      '^(?!/src/).*': {
        target: 'http://localhost:1313',
        changeOrigin: true
      }
    }
  }
});