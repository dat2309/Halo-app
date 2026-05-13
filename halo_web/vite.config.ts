import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so you can test from another device
  },
});
