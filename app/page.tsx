import {
  CTASection,
  ExploreCampusSection,
  FAQsSection,
  FeaturesSection,
  HeroSection,
  HowToJoinSection,
} from "@/features/home";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <ExploreCampusSection />
      <FeaturesSection />
      <HowToJoinSection />
      <FAQsSection />
      <CTASection />
    </main>
  );
}
