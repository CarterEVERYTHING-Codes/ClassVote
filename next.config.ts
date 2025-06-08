
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export', // Added for static HTML export
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
    // When using static export, next/image optimization needs to be handled.
    // For simplicity with GitHub Pages, we can unoptimize images.
    // Alternatively, you would use a custom loader or ensure your images are already optimized.
    unoptimized: true, 
  },
};

export default nextConfig;
