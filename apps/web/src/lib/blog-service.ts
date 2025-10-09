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

const blogPosts: BlogPost[] = [
  {
    id: (typeof frontmatter.slug === 'string' ? frontmatter.slug : undefined) || 'diary-vibes-alpha-building-something-new',
    title: (typeof frontmatter.title === 'string' ? frontmatter.title : undefined) || 'Diary Vibes Alpha: Building Something New',
    slug: (typeof frontmatter.slug === 'string' ? frontmatter.slug : undefined) || 'diary-vibes-alpha-building-something-new',
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
