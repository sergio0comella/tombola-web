import type { NextConfig } from "next";


/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["http://192.168.0.189:3000", "http://localhost:3000"],
  reactCompiler: true,
};

module.exports = nextConfig;


export default nextConfig;
