import { LandingHeader } from "./landing-header";
import { HeroSection } from "./hero-section";
import { HowItWorksSection } from "./how-it-works-section";
import { ConsensusSection } from "./consensus-section";
import { FeaturesSection } from "./features-section";
import { ArchitectureSection } from "./architecture-section";
import { FaqSection } from "./faq-section";
import { CtaBannerSection } from "./cta-banner-section";
import { LandingFooter } from "./landing-footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-foreground selection:bg-emerald-500 selection:text-zinc-950">
      <LandingHeader />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <ConsensusSection />
        <FeaturesSection />
        <ArchitectureSection />
        <FaqSection />
        <CtaBannerSection />
      </main>
      <LandingFooter />
    </div>
  );
}
