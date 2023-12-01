const path = require('path');

module.exports = {
  entry: './src/main.ts',
  module: {
    rules: [
      {
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'html-bridge.js',
    path: path.resolve(__dirname, 'dist'),
  },
};