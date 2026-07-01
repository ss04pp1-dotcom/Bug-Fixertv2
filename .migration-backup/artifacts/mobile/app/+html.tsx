import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: ICON_FONTS_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const ICON_FONTS_CSS = `
  @font-face {
    font-family: 'Ionicons';
    src: url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@15.1.1/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'MaterialIcons';
    src: url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@15.1.1/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'MaterialCommunityIcons';
    src: url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@15.1.1/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  html, body, #root { height: 100%; }
`;
