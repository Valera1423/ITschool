/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Backend API
  readonly VITE_API_URL: string;

  // Keycloak OIDC
  readonly VITE_OIDC_AUTHORITY: string;
  readonly VITE_OIDC_CLIENT_ID: string;
  readonly VITE_OIDC_REDIRECT_URI: string;
  readonly VITE_OIDC_POST_LOGOUT_REDIRECT_URI: string;
  readonly VITE_OIDC_SCOPE?: string;

  // MinIO
  readonly VITE_MINIO_PUBLIC_URL?: string;

  // Web Push
  readonly VITE_VAPID_PUBLIC_KEY?: string;

  // Sentry
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_VERSION?: string;

  // Supabase (legacy, не используется)
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly mode: string;
  readonly dev: boolean;
  readonly prod: boolean;
}