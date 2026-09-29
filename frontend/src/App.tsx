import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/components/ThemeProvider';
import { UndoProvider } from '@/components/UndoProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { Router } from './Router';
import { SwUpdateBanner } from '@/components/SwUpdateBanner';
import { ChangelogPopup } from '@/components/ChangelogPopup';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <UndoProvider>
          <AuthProvider>
            <Router />
            <SwUpdateBanner />
            <ChangelogPopup />
          </AuthProvider>
        </UndoProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}