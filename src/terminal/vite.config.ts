import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// In production the terminal is served at /terminal/ by trade-monitor's Express.
// In development it runs standalone on its own port (default 5000).
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  root: path.resolve(import.meta.dirname, 'client'),
  base: isProd ? '/terminal/' : '/',
  build: {
    outDir: path.resolve(import.meta.dirname, '../dist/terminal'),
    emptyOutDir: true,
  },
  server: {
    port: 5000,
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
  },
});
