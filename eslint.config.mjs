import js from "@eslint/js";
import vue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";
import prettier from "eslint-config-prettier/flat";

export default [
  {
    ignores: ["**/.nuxt/**", "**/.output/**", "**/dist/**", "**/generated/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.{ts,tsx,mjs,js}"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: "latest",
        parser: tseslint.parser,
        sourceType: "module",
      },
      globals: globals.browser,
    },
    rules: {
      "no-undef": "off",
    },
  },
  prettier,
];
