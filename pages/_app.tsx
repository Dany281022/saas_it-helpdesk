import { ClerkProvider } from '@clerk/nextjs';
import type { AppProps } from 'next/app';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/globals.css';

/**
 * MyApp - Composant racine (Root)
 * Fournit le contexte d'authentification Clerk à toute l'application.
 * Indispensable pour le fonctionnement du middleware et du gating Premium (Step 7).
 */
function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider 
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      {...pageProps}
    >
      <div className="min-h-screen bg-gray-50">
        <Component {...pageProps} />
      </div>
    </ClerkProvider>
  );
}

export default MyApp;