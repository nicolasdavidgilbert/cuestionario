import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: "https://e6c8d96d437c01733d19df52e1d5c72e@o4512023045668864.ingest.de.sentry.io/4512023059628112",
  tracesSampleRate: 1.0,
});
