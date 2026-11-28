import type { Metadata } from "next";

import { readSiteOrigin } from "@/core/seo";
import {
  CTASection,
  ExploreCampusSection,
  FAQsSection,
  FeaturesSection,
  FooterSection,
  HeroSection,
  HomeStructuredData,
  HowToJoinSection,
} from "@/features/home";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main>
      <HomeStructuredData origin={readSiteOrigin()} />
      <HeroSection />
      <ExploreCampusSection />
      <FeaturesSection />
      <HowToJoinSection />
      <FAQsSection />
      <CTASection />
      <FooterSection />
    </main>
  );
}
