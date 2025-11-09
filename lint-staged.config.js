export default {
  '**/*.{ts,tsx,js,jsx}': (files) => `prettier --write ${files.join(' ')}`,
  '**/*.{css,md,json,yml,yaml}': (files) => `prettier --write ${files.join(' ')}`,
};
