import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/latam-weather-clock/",
  plugins: [react()],
});
