import { ClerkProvider } from '@clerk/nextjs';
import type { AppProps } from 'next/app';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/globals.css';

/**
 * Composant racine de l'application Next.js.
 * Enveloppe l'application avec ClerkProvider pour gérer l'authentification SaaS (Step 7).
 */
function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider 
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      {...pageProps}
    >
      <Component {...pageProps} />
    </ClerkProvider>
  );
}

export default MyApp;
