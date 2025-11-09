export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  author: string;
  tags: string[];
  readTime: number;
}

// Import the actual markdown content
import markdownContent from '../content/blog/diary-vibes-alpha-building-something-new.md?raw';
import whyPeopleLoveContent from '../content/blog/why-people-fall-in-love-with-diary-vibes.md?raw';
import whatWereBuildingContent from '../content/blog/what-were-really-building-at-evokee.md?raw';

// Parse frontmatter from markdown
function parseFrontmatter(content: string) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, content };
  }
  
  const [, frontmatterStr, markdownContent] = match;
  const frontmatter: Record<string, string | string[]> = {};
  
  // Parse YAML-like frontmatter
  frontmatterStr.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      
      // Handle arrays (tags)
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value.slice(1, -1).split(',').map(item => item.trim().replace(/"/g, ''));
      } else {
        frontmatter[key] = value;
      }
    }
  });
  
  return { frontmatter, content: markdownContent };
}

const { frontmatter, content } = parseFrontmatter(markdownContent);
const { frontmatter: whyPeopleLoveFrontmatter, content: whyPeopleLoveContentParsed } = parseFrontmatter(whyPeopleLoveContent);
const { frontmatter: whatWereBuildingFrontmatter, content: whatWereBuildingContentParsed } = parseFrontmatter(whatWereBuildingContent);

const blogPosts: BlogPost[] = [
  {
    id: (typeof whatWereBuildingFrontmatter.slug === 'string' ? whatWereBuildingFrontmatter.slug : undefined) || 'what-were-really-building-at-evokee',
    title: (typeof whatWereBuildingFrontmatter.title === 'string' ? whatWereBuildingFrontmatter.title : undefined) || "What We're Really Building at Evokee",
    slug: (typeof whatWereBuildingFrontmatter.slug === 'string' ? whatWereBuildingFrontmatter.slug : undefined) || 'what-were-really-building-at-evokee',
    excerpt: (typeof whatWereBuildingFrontmatter.excerpt === 'string' ? whatWereBuildingFrontmatter.excerpt : undefined) || "Memory is a crime scene, and you're the unreliable witness. We're building Evokee because we finally understand the difference between documentation and memory.",
    content: whatWereBuildingContentParsed,
    publishedAt: (typeof whatWereBuildingFrontmatter.publishedAt === 'string' ? whatWereBuildingFrontmatter.publishedAt : undefined) || '2025-01-27',
    author: (typeof whatWereBuildingFrontmatter.author === 'string' ? whatWereBuildingFrontmatter.author : undefined) || 'Sam He',
    tags: Array.isArray(whatWereBuildingFrontmatter.tags) ? whatWereBuildingFrontmatter.tags : ['philosophy', 'memory', 'product', 'neuroscience', 'vision'],
    readTime: (typeof whatWereBuildingFrontmatter.readTime === 'string' ? parseInt(whatWereBuildingFrontmatter.readTime, 10) : typeof whatWereBuildingFrontmatter.readTime === 'number' ? whatWereBuildingFrontmatter.readTime : undefined) || 12,
  },
  {
    id: (typeof whyPeopleLoveFrontmatter.slug === 'string' ? whyPeopleLoveFrontmatter.slug : undefined) || 'why-people-fall-in-love-with-eveokee',
    title: (typeof whyPeopleLoveFrontmatter.title === 'string' ? whyPeopleLoveFrontmatter.title : undefined) || 'Turning Your Journal into a Soundtrack',
    slug: (typeof whyPeopleLoveFrontmatter.slug === 'string' ? whyPeopleLoveFrontmatter.slug : undefined) || 'why-people-fall-in-love-with-eveokee',
    excerpt: (typeof whyPeopleLoveFrontmatter.excerpt === 'string' ? whyPeopleLoveFrontmatter.excerpt : undefined) || 'Eight stories about why people fall in love with Eveokee.',
    content: whyPeopleLoveContentParsed,
    publishedAt: (typeof whyPeopleLoveFrontmatter.publishedAt === 'string' ? whyPeopleLoveFrontmatter.publishedAt : undefined) || '2025-10-16',
    author: (typeof whyPeopleLoveFrontmatter.author === 'string' ? whyPeopleLoveFrontmatter.author : undefined) || 'Sam He',
    tags: Array.isArray(whyPeopleLoveFrontmatter.tags) ? whyPeopleLoveFrontmatter.tags : ['stories', 'music', 'journaling', 'emotional-tech', 'user-stories'],
    readTime: (typeof whyPeopleLoveFrontmatter.readTime === 'string' ? parseInt(whyPeopleLoveFrontmatter.readTime, 10) : typeof whyPeopleLoveFrontmatter.readTime === 'number' ? whyPeopleLoveFrontmatter.readTime : undefined) || 8,
  },
  {
    id: (typeof frontmatter.slug === 'string' ? frontmatter.slug : undefined) || 'eveokee-alpha-building-something-new',
    title: (typeof frontmatter.title === 'string' ? frontmatter.title : undefined) || 'Eveokee Alpha: Building Something New',
    slug: (typeof frontmatter.slug === 'string' ? frontmatter.slug : undefined) || 'eveokee-alpha-building-something-new',
    excerpt: (typeof frontmatter.excerpt === 'string' ? frontmatter.excerpt : undefined) || 'The journey of creating an app that transforms your personal thoughts and experiences into personalized music.',
    content: content,
    publishedAt: (typeof frontmatter.publishedAt === 'string' ? frontmatter.publishedAt : undefined) || '2024-10-15',
    author: (typeof frontmatter.author === 'string' ? frontmatter.author : undefined) || 'Sam He',
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : ['launch', 'alpha', 'music', 'journaling', 'personal'],
    readTime: (typeof frontmatter.readTime === 'string' ? parseInt(frontmatter.readTime, 10) : typeof frontmatter.readTime === 'number' ? frontmatter.readTime : undefined) || 5,
  }
];

// Simple blog service without markdown loading for now
async function loadBlogPosts(): Promise<BlogPost[]> {
  // Simulate async loading
  return new Promise((resolve) => {
    setTimeout(() => resolve(blogPosts), 100);
  });
}

export class BlogService {
  static async getAllPosts(): Promise<BlogPost[]> {
    const posts = await loadBlogPosts();
    return posts.sort((a, b) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  static async getPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const posts = await loadBlogPosts();
    return posts.find(post => post.slug === slug);
  }

  static async getPostById(id: string): Promise<BlogPost | undefined> {
    const posts = await loadBlogPosts();
    return posts.find(post => post.id === id);
  }

  static async getRecentPosts(limit: number = 3): Promise<BlogPost[]> {
    const posts = await this.getAllPosts();
    return posts.slice(0, limit);
  }

  static async getPostsByTag(tag: string): Promise<BlogPost[]> {
    const posts = await loadBlogPosts();
    return posts.filter(post => 
      post.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );
  }
}
