import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>nicecream.fm</title>
        <meta name="description" content="three channels of house music, curated by humans" />

        {/* Open Graph / Social */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="nicecream.fm" />
        <meta
          property="og:description"
          content="three channels of house music, curated by humans"
        />
        <meta property="og:site_name" content="nicecream.fm" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="nicecream.fm" />
        <meta
          name="twitter:description"
          content="three channels of house music, curated by humans"
        />

        {/* Theme color for browser chrome */}
        <meta name="theme-color" content="#000000" />

        {/* Disable body scrolling on web for native app feel */}
        <ScrollViewStyleReset />

        {/* Add any additional web-only styles */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #000;
}
`;
