import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const nextConfig = {
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" }
    ] }];
  }
};
export default nextConfig;
