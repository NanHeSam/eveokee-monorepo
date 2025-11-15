import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import HeroSection from '../components/HeroSection';
import DemoPreviewSection from '../components/DemoPreviewSection';
import HowItWorksSection from '../components/HowItWorksSection';
import FAQSection from '../components/FAQSection';
import FinalCTASection from '../components/FinalCTASection';
import { StructuredData, generateOrganizationStructuredData, generateWebsiteStructuredData } from '../components/StructuredData';

/**
 * Render the Home page including site structured data and the main landing sections.
 *
 * @returns The JSX element for the Home page, containing organization and website structured-data nodes followed by the hero, demo preview, how-it-works, FAQ, and final CTA sections.
 */
export default function Home() {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://eveokee.com";
  const organizationData = generateOrganizationStructuredData(baseUrl);
  const websiteData = generateWebsiteStructuredData(baseUrl);
  const location = useLocation();

  // Handle hash navigation when navigating from another page
  useEffect(() => {
    if (location.hash) {
      // Remove the # from the hash
      const anchor = location.hash.substring(1);
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(anchor);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [location.hash]);

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