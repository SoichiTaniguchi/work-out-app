// metro.config.js
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// server/ はNAS上で動かすNode.jsのコードで、アプリのバンドルには含めない。
// 除外しないとMetroが server/node_modules まで監視してしまう。
const serverDir = path.resolve(__dirname, 'server') + path.sep;
const serverPattern = new RegExp(`^${serverDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`);
const existingBlockList = config.resolver.blockList;

config.resolver.blockList = Array.isArray(existingBlockList)
  ? [...existingBlockList, serverPattern]
  : existingBlockList
    ? [existingBlockList, serverPattern]
    : [serverPattern];

module.exports = config;
