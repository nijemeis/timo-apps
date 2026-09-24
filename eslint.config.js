// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // React Native adjustments to the stock Expo config.
    rules: {
      // `<Text>` renders literal strings — HTML entity escaping is irrelevant
      // here (and wrong: "you're" must stay "you're", not "you&apos;re").
      'react/no-unescaped-entities': 'off',

      // Defining components inline in React Navigation `options` (headers,
      // tab-bar icons) is idiomatic and doesn't need a display name.
      'react/display-name': 'warn',

      // This app syncs external state (beacon ranging, permission reads) in
      // effects; setState from those effects is intentional.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
