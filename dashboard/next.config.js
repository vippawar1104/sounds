/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@livekit/components-react", "@livekit/components-styles", "livekit-client"],
  async rewrites() {
    // BACKEND_URL is a runtime env var set in Railway (no NEXT_PUBLIC_ prefix needed)
    // This proxy means the frontend doesn't need to know the backend URL at build time.
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

