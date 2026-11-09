import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Nota: sin proxy hacia el backend porque Vite corre dentro de WSL y ahi
// 127.0.0.1 no es el Windows donde vive Spring Boot (daba 502).
// El frontend llama directo a http://localhost:8080/api/v1 y el CORS lo
// permite SecurityConfig#corsConfigurationSource del backend.
export default defineConfig({
  plugins: [react()],
  base: './'
})
