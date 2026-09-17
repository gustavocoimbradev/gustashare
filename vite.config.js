import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Desktop (Electron, file://) precisa de caminhos relativos.
  // A versão web na Vercel usa `vite build --base /` (npm run build:web).
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
