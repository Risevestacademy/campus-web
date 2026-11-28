import { JsonLd, SITE_DESCRIPTION, SITE_NAME } from "@/core/seo";

import { faqs } from "./faqs";

interface HomeStructuredDataProps {
  origin: URL | undefined;
}

function buildHomeStructuredData(origin: URL) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${origin.href}#website`,
        url: origin.href,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { "@type": "Organization", name: "Rise" },
      },
      {
        "@type": "FAQPage",
        "@id": `${origin.href}#faqs`,
        url: origin.href,
        mainEntity: faqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}

// Schema.org URLs must be absolute, and a deployment without a site URL is
// noindex anyway.
export function HomeStructuredData({ origin }: HomeStructuredDataProps) {
  return origin ? <JsonLd data={buildHomeStructuredData(origin)} /> : null;
}
