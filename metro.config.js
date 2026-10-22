// Expo's default Metro config plus Sentry's serializer, which gives each bundle
// and source map a Debug ID so crash reports can be symbolicated.
// https://docs.sentry.io/platforms/react-native/guides/expo/
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
