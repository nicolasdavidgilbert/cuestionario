/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_ADSENSE_CLIENT?: string
  readonly PUBLIC_ENABLE_ADS?: string
  readonly PUBLIC_CONTACT_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace App {
  interface Locals {
    // Sesión de administración comprobada por src/middleware.ts en /admin y /api/admin/*
    admin?: {
      id: string
      csrfToken: string
      expiresAt: string
      viaApiKey: boolean
    }
  }
}

declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text?: string
  }

  const pdfParse: (buffer: Uint8Array) => Promise<PdfParseResult>
  export default pdfParse
}
