/** @type {import('lint-staged').Config} */
module.exports = {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{js,mjs,cjs}': ['prettier --write'],
  '*.{json,md,yaml,yml}': ['prettier --write'],
};
