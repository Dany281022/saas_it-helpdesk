import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Structure HTML globale de l'application.
 * Note : Les titres et viewports sont gérés dans les pages individuelles 
 * pour un meilleur SEO et une meilleure hydratation React.
 */
export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        {/* On ne garde ici que les polices ou les liens globaux */}
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