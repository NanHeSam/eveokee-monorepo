import DemoCard from './DemoCard';
import { motion } from 'framer-motion';

interface DemoItem {
  id: string;
  lyric: string;
  trackTitle: string;
  date: string;
  duration: string;
  waveformColor: string;
  imageUrl: string;
  audioUrl: string;
  startTime: number;
}

interface DemoPreviewSectionProps {
  onPlayDemo?: (demoId: string) => void;
}

const demoCards: DemoItem[] = [
  {
    id: '1',
    lyric: 'Mushrooms hiding like a secret dream\nTomato sauce flows like a lava stream\nExtra olives\nYeah\nDon\'t hold back\nThis slice of life\'s my favorite snack',
    trackTitle: 'Slice of Heaven',
    date: 'October 1, 2025',
    duration: '1:59',
    waveformColor: 'from-accent-mint/40 to-accent-mint/60',
    imageUrl: 'https://apiboxfiles.erweima.ai/ZGIwZWMzNGQtY2E5NS00ODZiLTlhYjgtYTMzNDQ0N2I0NGYy.jpeg',
    audioUrl: 'https://apiboxfiles.erweima.ai/ZGIwZWMzNGQtY2E5NS00ODZiLTlhYjgtYTMzNDQ0N2I0NGYy.mp3',
    startTime: 35
  },
  {
    id: '2',
    lyric: 'Dependency danced\nA tangled mess\nUpdates turned the no into yes\nSweat and coffee\nNo time to rest',
    trackTitle: 'Wild Ride',
    date: 'October 1, 2025',
    duration: '2:42',
    waveformColor: 'from-accent-apricot/40 to-accent-apricot/60',
    imageUrl: 'https://cdn2.suno.ai/image_f73772ff-d611-4a21-8e8d-53b4fb8de6fb.jpeg',
    audioUrl: 'https://cdn1.suno.ai/f73772ff-d611-4a21-8e8d-53b4fb8de6fb.mp3',
    startTime: 77
  },
  {
    id: '3',
    lyric: 'Approval pending\nI\'m stuck on hold\nDreams in the cloud\nLeft out in the cold\nApple\nOh Apple\nJust give me a sign\nYour clock\'s not the same as mine',
    trackTitle: 'Approval Pending',
    date: 'October 2, 2025',
    duration: '2:56',
    waveformColor: 'from-purple-400/40 to-purple-600/60',
    imageUrl: 'https://cdn2.suno.ai/image_b28aad1b-2d89-44f9-9f06-0e4fe429f98e.jpeg',
    audioUrl: 'https://cdn1.suno.ai/b28aad1b-2d89-44f9-9f06-0e4fe429f98e.mp3',
    startTime: 45
  }
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export default function DemoPreviewSection({ onPlayDemo }: DemoPreviewSectionProps) {

  return (
    <section id="demo" className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Listen to what real moments sound like.
          </h2>
        </motion.div>

        {/* Demo Cards Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12"
        >
          {demoCards.map((demo) => (
            <motion.div key={demo.id} variants={item}>
              <DemoCard
                lyric={demo.lyric}
                title={demo.trackTitle}
                date={demo.date}
                imageUrl={demo.imageUrl}
                audioId={demo.id}
                audioUrl={demo.audioUrl}
                startTime={demo.startTime}
                duration={demo.duration}
                onPlay={() => onPlayDemo?.(demo.id)}
              />
            </motion.div>
          ))}
        </motion.div>


      </div>
    </section>
  );
}

