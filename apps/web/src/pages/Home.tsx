import HeroSection from '../components/HeroSection';
import DemoPreviewSection from '../components/DemoPreviewSection';
import HowItWorksSection from '../components/HowItWorksSection';
import FAQSection from '../components/FAQSection';
import FinalCTASection from '../components/FinalCTASection';
import { StructuredData, generateOrganizationStructuredData, generateWebsiteStructuredData } from '../components/StructuredData';

export default function Home() {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://eveokee.com";
  const organizationData = generateOrganizationStructuredData(baseUrl);
  const websiteData = generateWebsiteStructuredData(baseUrl);

  return (
    <>
      <StructuredData data={organizationData} />
      <StructuredData data={websiteData} />
      <HeroSection />
      {/* <EmotionalHookSection /> */}
      <DemoPreviewSection />
      <HowItWorksSection />
      <FAQSection />
      <FinalCTASection />
    </>
  );
}