// eslint-disable-next-line @typescript-eslint/no-require-imports
const baseConfig = require("../../packages/config/eslint/base.js");

module.exports = {
  root: true,
  ...baseConfig,
  ignorePatterns: ["dist/**", "*.config.js"],
};
