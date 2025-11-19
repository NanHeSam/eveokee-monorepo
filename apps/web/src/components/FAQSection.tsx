import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    id: '1',
    question: 'Is my data private?',
    answer: 'Absolutely. Your diary entries are encrypted and stored securely. I never share your personal content with third parties. You have full control over your data and can delete it at any time.'
  },
  {
    id: '2',
    question: 'How much does it cost?',
    answer: 'I am currently in beta and free to use! Once I launch, I\'ll have a freemium model with basic features available for free and premium features for subscribers. Early beta users will get special pricing.'
  },
  {
    id: '3',
    question: 'When will the iOS app be released?',
    answer: 'I\'m working hard on both iOS and Android apps! The iOS app is expected to launch in Q2 2024, with Android following shortly after. Join my waitlist to be notified as soon as they\'re available.'
  },
  {
    id: '4',
    question: 'Do I need to be musical?',
    answer: 'Not at all! That\'s the beauty of eveokee. You just write your thoughts and feelings naturally, and my AI handles all the musical creation. No musical knowledge or experience required.'
  }
];

export default function FAQSection() {
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  return (
    <section id="faq" className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            FAQs
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Everything you need to know about eveokee
          </p>
        </motion.div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openFAQ === faq.id;

            return (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full px-6 py-6 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white pr-4">
                    {faq.question}
                  </h3>

                  <div className="flex-shrink-0">
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {isOpen ? (
                        <Minus className="w-5 h-5 text-accent-mint" />
                      ) : (
                        <Plus className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      )}
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6">
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Additional Help */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-center mt-12"
        >
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Still have questions?
          </p>
          <a
            href="mailto:support@eveoky.com"
            className="inline-flex items-center text-accent-mint hover:text-accent-mint/80 font-medium transition-colors"
          >
            Get in touch with my team
          </a>
        </motion.div>
      </div>
    </section>
  );
}