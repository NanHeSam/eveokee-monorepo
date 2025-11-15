export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
          Effective Date: October 6, 2025 • Last Updated: October 6, 2025 — Version 1.0
        </p>

        <p className="mb-6 text-gray-700 dark:text-gray-300">
          This Privacy Policy explains how eveokee ("we," "our," "us") collects, uses, and shares your personal information when you use 
          <span className="font-mono"> https://www.eveokee.com </span> (the "Site") and related services (the "Services"). By using our Services, you agree to this Policy.
        </p>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>
                <span className="font-semibold">Account Information:</span> When you create an account, we collect your email and any details you provide.
              </li>
              <li>
                <span className="font-semibold">Diary Entries:</span> We store the text you write in your diaries to generate music and provide the service.
              </li>
              <li>
                <span className="font-semibold">Generated Content:</span> We store metadata about AI-generated music (e.g., prompts, timestamps) for functionality and improvement.
              </li>
              <li>
                <span className="font-semibold">Usage Data:</span> We collect anonymized technical data (e.g., browser type, device, IP address, pages visited) for analytics and security.
              </li>
              <li>
                <span className="font-semibold">Third-Party Services:</span> We use Suno AI to generate music based on your entries. Your diary content may be sent to Suno AI’s API for processing.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. How We Use Information</h2>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Provide and maintain the Services.</li>
              <li>Generate AI music using third-party tools.</li>
              <li>Improve and personalize your experience.</li>
              <li>Communicate with you about updates or support.</li>
              <li>Ensure security and prevent misuse.</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-2">We do not sell personal data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. How We Share Information</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-2">We may share data with:</p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li><span className="font-semibold">Service Providers:</span> Such as Suno AI for music generation.</li>
              <li><span className="font-semibold">Legal Authorities:</span> If required by law or to protect our rights.</li>
              <li><span className="font-semibold">Business Transfers:</span> In case of merger, acquisition, or sale of assets.</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-2">We do not share diary content publicly without your consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Data Retention</h2>
            <p className="text-gray-700 dark:text-gray-300">
              We retain your data as long as your account is active or as needed to provide Services. You may delete your account to remove personal information. Some anonymized or aggregated data may be retained for analytics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Your Rights (California Residents)</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-2">If you are a California resident, you have rights under the California Consumer Privacy Act (CCPA), including:</p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
              <li>Request access to your personal information.</li>
              <li>Request deletion of your data.</li>
              <li>Opt-out of data sharing (we do not sell data).</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-2">To exercise these rights, contact <span className="font-mono">support@eveoky.com</span>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Security</h2>
            <p className="text-gray-700 dark:text-gray-300">
              We use reasonable technical and organizational measures to protect your data, but no system is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Third-Party Links</h2>
            <p className="text-gray-700 dark:text-gray-300">
              Our Services may contain links to third-party websites. We are not responsible for their privacy practices.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Children's Privacy</h2>
            <p className="text-gray-700 dark:text-gray-300">
              Our Services are not directed to children under 13. We do not knowingly collect personal data from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">9. Changes to This Policy</h2>
            <p className="text-gray-700 dark:text-gray-300">
              We may update this Privacy Policy at any time. The updated version will be posted on this page with the new effective date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">10. Contact</h2>
            <p className="text-gray-700 dark:text-gray-300">If you have questions or requests regarding this Privacy Policy, contact us at:</p>
            <p className="text-gray-700 dark:text-gray-300">📧 <span className="font-mono">support@eveoky.com</span></p>
            <p className="text-gray-700 dark:text-gray-300">📍 Campbell, California, USA</p>
          </section>
        </div>
      </div>
    </div>
  );
}