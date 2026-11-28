import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FAQsSection } from "./sections/faqs";
import { HomeStructuredData } from "./structured-data";

interface SchemaNode {
  "@type": string;
  mainEntity?: { name: string }[];
}

function structuredQuestions(container: HTMLElement): string[] {
  const script = container.querySelector('script[type="application/ld+json"]');
  const graph: SchemaNode[] = JSON.parse(script?.textContent ?? "{}")["@graph"];
  const faqPage = graph.find((node) => node["@type"] === "FAQPage");

  return faqPage?.mainEntity?.map(({ name }) => name) ?? [];
}

describe("HomeStructuredData", () => {
  it("describes exactly the questions the FAQ section shows", () => {
    const { container } = render(
      <HomeStructuredData origin={new URL("https://campus.example.test")} />,
    );
    render(<FAQsSection />);

    const shown = screen
      .getAllByRole("button")
      .map((trigger) => trigger.textContent);

    expect(structuredQuestions(container)).toEqual(shown);
  });

  it("renders nothing without a site URL, so no relative schema URLs ship", () => {
    const { container } = render(<HomeStructuredData origin={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});
