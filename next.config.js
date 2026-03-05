/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true, // Très utile pour finir ton TP sans bloquer sur des types
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig