/** @type {import('next').NextConfig} */
const nextConfig = {
  // Left for the Node runtime to require at run time instead of being bundled.
  //
  // @napi-rs/canvas resolves to a platform-specific .node binary, and webpack
  // has no loader for one — it reads the Skia blob as source and the build
  // fails outright. pdf.js is here for the same class of reason: its legacy
  // build resolves font and cmap data by filesystem path, which only works if
  // the package is still a package on disk.
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist', 'sharp'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
    ],
    unoptimized: true, // Allow all image sources without optimization
  },
};

export default nextConfig;