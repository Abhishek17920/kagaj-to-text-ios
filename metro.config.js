// Default Expo Metro config. Kept explicit so it is easy to extend later
// (e.g. svg transformer, monorepo watchFolders).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

module.exports = config;
