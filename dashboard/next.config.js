/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@livekit/components-react", "@livekit/components-styles", "livekit-client"],
};

module.exports = nextConfig;
