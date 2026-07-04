// Renders a JSON-LD structured-data <script> for search engines and AI answer
// engines. Server-renderable; the string is emitted into the initial HTML.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe here — the data is authored, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
