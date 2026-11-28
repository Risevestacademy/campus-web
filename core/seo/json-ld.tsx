interface JsonLdProps {
  data: Readonly<Record<string, unknown>>;
}

// JSON.stringify leaves "<" alone, so a value holding "</script>" would close
// the tag and run whatever follows as HTML.
function serializeJsonLd(data: JsonLdProps["data"]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
