import { LandingHero } from "../components/landing/LandingHero";
import { DifferentiatorGrid } from "../components/landing/DifferentiatorGrid";
import { HowItWorks } from "../components/landing/HowItWorks";
import { FeaturedMethods } from "../components/landing/FeaturedMethods";
import { BuilderTeaser } from "../components/landing/BuilderTeaser";

interface Props {
  onGotoAnalyze: () => void;
  onGotoMethodsIndex: () => void;
  onGotoArticle: (slug: string) => void;
  onGotoAbout: () => void;
}

/**
 * The new landing page served at `/` when the app boots. Replaces
 * the previous default of dumping a first-time visitor straight into
 * the FileUpload dropzone. Five vertical sections compose a short
 * narrative: hero → why it's different → how it works → documented
 * methodology → the person who built it → footer. Each section is
 * independently maintainable (all live under components/landing/).
 */
export default function LandingPage({
  onGotoAnalyze,
  onGotoMethodsIndex,
  onGotoArticle,
  onGotoAbout,
}: Props) {
  return (
    <>
      <LandingHero
        onCtaAnalyze={onGotoAnalyze}
        onCtaMethod={onGotoMethodsIndex}
      />
      <DifferentiatorGrid onGotoMethod={onGotoArticle} />
      <HowItWorks />
      <FeaturedMethods
        onGotoArticle={onGotoArticle}
        onGotoMethodsIndex={onGotoMethodsIndex}
      />
      <BuilderTeaser onGotoAbout={onGotoAbout} />
    </>
  );
}
