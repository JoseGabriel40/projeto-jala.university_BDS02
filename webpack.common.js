const path = require('path');

module.exports = {
  entry: {
    app: './.idea/projeto/frontend/script.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    filename: './.idea/projeto/frontend/script.js',
  },
};
