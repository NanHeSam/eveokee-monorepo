import { Heart, Twitter, Mail, Smartphone } from 'lucide-react';
import { SiDiscord } from 'react-icons/si';
import { FaInstagram } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { getAndroidBetaLink } from '../utils/deviceUtils';
import AndroidInviteForm from './AndroidInviteForm';

/**
 * Renders the eveokee site footer with branding, social links, quick navigation, and legal links.
 *
 * Displays the product title and tagline, social icons for Discord, X (Twitter), and email, quick links to Demo, How it works, and FAQ, and a bottom bar that shows the current year, a heart attribution, and links to Privacy Policy and Terms and Conditions.
 *
 * @returns The footer JSX element containing the complete site footer layout.
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();
  const androidBetaLink = getAndroidBetaLink();

  return (
    <footer className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-12 grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold mb-4">eveokee</h3>
            <p className="text-gray-400 dark:text-gray-500 mb-6 max-w-md">
              Turn your diary into sound. A new way of journaling where your words become music.
            </p>
            
            {/* Social Links */}
            <div className="flex space-x-4">
              <a 
                href="https://discord.gg/3NbtyUGSCv" 
                className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center hover:bg-accent-mint transition-colors"
                aria-label="Join Discord"
                target="_blank"
                rel="noopener noreferrer"
              >
                <SiDiscord className="w-5 h-5" />
              </a>
              <a 
                href="https://x.com/eveoky_vibes" 
                className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center hover:bg-accent-mint transition-colors"
                aria-label="Twitter"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a 
                href="https://www.instagram.com/myeveokee/" 
                className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center hover:bg-accent-mint transition-colors"
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaInstagram className="w-5 h-5" />
              </a>
              <a 
                href="mailto:hello@eveoky.com" 
                className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center hover:bg-accent-mint transition-colors"
                aria-label="Email"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-gray-400 dark:text-gray-500">
              <li>
                <a href="#demo" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  Demo
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  How it works
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
          
          {/* Beta Testing */}
          <div>
            <h4 className="font-semibold mb-4">Beta Testing</h4>
            <ul className="space-y-2 text-gray-400 dark:text-gray-500">
              <li>
                <a 
                  href="https://testflight.apple.com/join/aGT4PMED" 
                  className="hover:text-gray-900 dark:hover:text-white transition-colors inline-flex items-center gap-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Smartphone className="w-4 h-4" />
                  iOS TestFlight
                </a>
              </li>
              <li>
                <a 
                  href={androidBetaLink} 
                  className="hover:text-gray-900 dark:hover:text-white transition-colors inline-flex items-center gap-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Smartphone className="w-4 h-4" />
                  Android Beta
                </a>
                <p className="text-xs text-gray-500 dark:text-gray-600 mt-2 mb-2">
                  Internal test — enter your Google Play email to request access
                </p>
                <AndroidInviteForm source="footer" className="mt-2" />
              </li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="border-t border-gray-200 dark:border-gray-700 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start space-y-4 md:space-y-0 text-center md:text-left">
            {/* Copyright */}
            <div className="flex flex-wrap items-center justify-center md:justify-start text-gray-400 dark:text-gray-500 text-sm gap-x-1">
              <span>&copy; {currentYear} eveokee.</span>
              <span className="flex items-center">
                Made with
                <Heart className="w-4 h-4 text-accent-mint mx-1" />
              </span>
            </div>
            
            {/* Legal Links */}
            <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 text-sm text-gray-400 dark:text-gray-500">
              <a href="/privacy" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Privacy Policy
              </a>
              <Link to="/terms" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Terms and Conditions
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
