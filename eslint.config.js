import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: (await import("@babel/eslint-parser")).default,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-typescript"],
        },
        sourceType: "module",
      },
    },
    rules: {
      // Type checking (including undefined/unused checks) is handled by tsc, not ESLint.
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
  {
    languageOptions: {
      globals: {
        console: "readonly",
        crypto: "readonly",
        process: "readonly",
      },
    },
  },
  prettierConfig,
];
