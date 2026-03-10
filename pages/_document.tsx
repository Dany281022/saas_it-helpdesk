import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <title>IT Help Desk | Ticket Resolver</title>
        <meta
          name="description"
          content="TechFix AI: AI-powered IT support assistant that analyzes technical tickets, provides diagnostics, and step-by-step resolution guides instantly."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body className="bg-gray-50 text-gray-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}