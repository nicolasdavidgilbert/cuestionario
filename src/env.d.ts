/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_ADSENSE_CLIENT?: string
  readonly PUBLIC_ENABLE_ADS?: string
  readonly PUBLIC_CONTACT_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text?: string
  }

  const pdfParse: (buffer: Uint8Array) => Promise<PdfParseResult>
  export default pdfParse
}
