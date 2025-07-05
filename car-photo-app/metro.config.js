const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add node core modules polyfills
config.resolver.alias = {
  ...config.resolver.alias,
  buffer: 'buffer',
};

module.exports = config;
