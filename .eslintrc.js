module.exports = {
  extends: ["next/core-web-vitals"],
  ignorePatterns: ["**/*.test.ts", "**/*.test.tsx", "__tests__"],
  rules: {
    "react/display-name": "off",
    "@next/next/no-html-link-for-pages": "off",
  },
};
