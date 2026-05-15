/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'aegbossvwssvvevjiqgi.supabase.co',
      },
    ],
    // Local images in /public are served without configuration
  },
}

module.exports = nextConfig
