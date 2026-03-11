// pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Global HTML structure of the application.
 * Note: Titles and viewports are managed within individual pages 
 * for better SEO and React hydration.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Global fonts or static assets */}
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#4f46e5" />
      </Head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
