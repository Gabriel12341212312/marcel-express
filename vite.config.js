import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // honour PORT so tooling (and multiple parallel dev servers) can pick one
    port: Number(process.env.PORT) || 5173,
    open: false,
    host: true,
  },
  build: {
    target: 'es2020',
  },
});
