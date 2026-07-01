module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { 'react-compiler': false }]],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
            '@/components': './components',
            '@/lib': './lib',
            '@/hooks': './hooks',
            '@/constants': './constants',
            '@/services': './services',
            '@/assets': './assets',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
