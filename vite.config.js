import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// Proxy keeps the browser on ONE origin, so HttpOnly/SameSite=Strict cookies just work and CORS isn't needed in dev.
export default defineConfig({plugins:[react()],server:{port:5173,proxy:{'/api':{target:process.env.VITE_API_TARGET||'https://localhost:5111',changeOrigin:true,secure:false}}}});
