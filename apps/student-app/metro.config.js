const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];
config.resolver.extraNodeModules = {
  "@mamute/api": path.resolve(workspaceRoot, "packages/api"),
  "@mamute/config": path.resolve(workspaceRoot, "packages/config"),
  "@mamute/types": path.resolve(workspaceRoot, "packages/types"),
  "@mamute/ui": path.resolve(workspaceRoot, "packages/ui"),
  "@mamute/utils": path.resolve(workspaceRoot, "packages/utils")
};
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
