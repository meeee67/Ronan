import type { NextConfig } from "next";

// Static export for GitHub Pages project sites is served from /<repo>/,
// so only apply the base path when explicitly building for that target.
const isGithubPagesBuild = process.env.DEPLOY_TARGET === "github-pages";
const basePath = "/Ronan";

const nextConfig: NextConfig = {
  output: isGithubPagesBuild ? "export" : undefined,
  basePath: isGithubPagesBuild ? basePath : undefined,
  assetPrefix: isGithubPagesBuild ? `${basePath}/` : undefined,
};

export default nextConfig;
