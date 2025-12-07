// eslint-disable-next-line @typescript-eslint/no-require-imports
const baseConfig = require("../../packages/config/eslint/base.js");

module.exports = {
  root: true,
  ...baseConfig,
  ignorePatterns: ["dist/**", "*.config.js"],
  rules: {
    ...baseConfig.rules,
    "@typescript-eslint/no-explicit-any": "off", // Disable any check - too many false positives
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
    ],
  },
};
