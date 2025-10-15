import HeroSection from '../components/HeroSection';
import DemoPreviewSection from '../components/DemoPreviewSection';
import HowItWorksSection from '../components/HowItWorksSection';
import FAQSection from '../components/FAQSection';
import FinalCTASection from '../components/FinalCTASection';

export default function Home() {
  return (
    <>
      <HeroSection />
      {/* <EmotionalHookSection /> */}
      <DemoPreviewSection />
      <HowItWorksSection />
      <FAQSection />
      <FinalCTASection />
    </>
  );
}