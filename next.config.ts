import type { NextConfig } from "next";


/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["http://localhost:3000"],
  reactCompiler: true,
};

module.exports = nextConfig;


export default nextConfig;
