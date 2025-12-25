import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{js,jsx,ts,tsx,mjs}"],
        plugins: {
            "react-hooks": reactHooks,
        },
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
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
            ],
            ...reactHooks.configs.recommended.rules,
            // Allow exhaustive-deps warnings - these are often intentionally omitted to prevent infinite loops
            "react-hooks/exhaustive-deps": "warn",
        },
    },
    {
        ignores: [
            ".next/**",
            "dist/**",
            "node_modules/**",
            "**/node_modules/**",
            ".pnpm/**",
            "**/.pnpm/**",
        ],
    },
];
