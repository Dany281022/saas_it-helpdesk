// pages/_app.tsx
import { ClerkProvider } from '@clerk/nextjs';
import type { AppProps } from 'next/app';

// Step 7a: Ensure DatePicker and Global styles are imported
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/globals.css';

/**
 * MyApp - Root Component
 * Provides the Clerk Authentication context to the entire application.
 * This wrapper is essential for <Protect /> and useAuth() to function.
 */
export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider {...pageProps}>
      <Component {...pageProps} />
    </ClerkProvider>
  );
}