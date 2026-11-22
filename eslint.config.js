import eslint from "@eslint/js";
import {defineConfig} from "eslint/config";
import tseslint from "typescript-eslint";
import globals from "globals";

export default defineConfig(
    {
        ignores: ["lib/**", "node_modules/**"]
    },
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.mocha
            }
        },
        rules: {
            // The ODM works with arbitrary MongoDB documents and runs with strict: false; `any` is intentional.
            "@typescript-eslint/no-explicit-any": "off"
        }
    }
);
