/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enables the SWC styled-components transform (consistent class names for SSR,
  // better debugging). Pairs with the ServerStyleSheet registry in src/lib/registry.tsx.
  compiler: {
    styledComponents: true,
  },
};

export default nextConfig;
