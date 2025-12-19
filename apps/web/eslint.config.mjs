import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{js,jsx,ts,tsx,mjs}"],
        languageOptions: {
            globals: {
                console: "readonly",
                module: "readonly",
                require: "readonly",
                process: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
            },
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off", // Disable any check - too many false positives
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
            ],
        },
    },
    {
        ignores: [".next/**", "dist/**", "node_modules/**"],
    },
];
