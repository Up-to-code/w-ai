const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin();

// Project-relative path (Turbopack rejects absolute aliases by prefixing "./").
const puckBrowser = "./node_modules/@puckeditor/core/dist/index.mjs";
const puckBrowserAbs = path.join(
  __dirname,
  "node_modules/@puckeditor/core/dist/index.mjs",
);

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Version every client asset so deployments and long-lived dashboard tabs
  // never mix old UI modules with a new server render.
  deploymentId: process.env.DEPLOYMENT_VERSION || "cv-ui-v2",
  transpilePackages: ["@puckeditor/core"],
  turbopack: {
    resolveAlias: {
      // Must be project-relative for Turbopack
      "@puck-editor": puckBrowser,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@puck-editor": puckBrowserAbs,
    };
    return config;
  },
  compress: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
