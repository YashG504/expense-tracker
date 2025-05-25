import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "/expense-tracker/", // ← Add this line
  plugins: [react()],
})
