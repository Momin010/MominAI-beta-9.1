import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2015',
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'monaco-vendor': ['monaco-editor', '@monaco-editor/react'],
          'ai-vendor': ['@google/genai', '@supabase/supabase-js'],
          'ui-vendor': ['lucide-react', 'recharts', 'date-fns'],
          'webcontainer-vendor': ['@webcontainer/api']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react']
  }
})