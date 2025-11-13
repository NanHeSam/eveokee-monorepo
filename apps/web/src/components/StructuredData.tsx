/**
 * JSON-LD Structured Data components for SEO
 * Provides structured data for search engines using JSON-LD format
 */

import { BlogPost } from "@/lib/blog-service";

interface StructuredDataProps {
  data: Record<string, unknown>;
}

/**
 * Renders JSON-LD structured data in a script tag
 */
export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Generate Article structured data for a blog post
 */
export function generateArticleStructuredData(
  post: BlogPost,
  baseUrl: string = typeof window !== "undefined" ? window.location.origin : "https://eveokee.com"
): Record<string, unknown> {
  const postUrl = `${baseUrl}/blog/${post.slug}`;
  const publishedDate = post.publishedAt 
    ? new Date(post.publishedAt).toISOString()
    : new Date(post._creationTime).toISOString();
  const modifiedDate = post.updatedAt
    ? new Date(post.updatedAt).toISOString()
    : publishedDate;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || post.title,
    image: post.canonicalUrl ? undefined : `${baseUrl}/og-image.png`, // Add OG image if available
    datePublished: publishedDate,
    dateModified: modifiedDate,
    author: {
      "@type": "Person",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "eveokee",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/favicon.svg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    url: postUrl,
    ...(post.canonicalUrl && { url: post.canonicalUrl }),
    ...(post.readingTime && {
      timeRequired: `PT${post.readingTime}M`,
    }),
    ...(post.tags.length > 0 && {
      keywords: post.tags.join(", "),
    }),
  };
}

/**
 * Generate Blog structured data for the blog listing page
 */
export function generateBlogStructuredData(
  posts: BlogPost[],
  baseUrl: string = typeof window !== "undefined" ? window.location.origin : "https://eveokee.com"
): Record<string, unknown> {
  const blogData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "eveokee Blog",
    description: "Stories, insights, and updates from the journey of building something that turns your words into music.",
    url: `${baseUrl}/blog`,
    publisher: {
      "@type": "Organization",
      name: "eveokee",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/favicon.svg`,
      },
    },
  };

  // Only include blogPost array if there are posts
  if (posts.length > 0) {
    blogData.blogPost = posts.slice(0, 10).map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: `${baseUrl}/blog/${post.slug}`,
      datePublished: post.publishedAt 
        ? new Date(post.publishedAt).toISOString()
        : new Date(post._creationTime).toISOString(),
      author: {
        "@type": "Person",
        name: post.author,
      },
    }));
  }

  return blogData;
}

/**
 * Generate Organization structured data for the homepage
 */
export function generateOrganizationStructuredData(
  baseUrl: string = typeof window !== "undefined" ? window.location.origin : "https://eveokee.com"
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "eveokee",
    url: baseUrl,
    logo: `${baseUrl}/favicon.svg`,
    description: "Turn your words into music. A journaling app that creates personalized soundtracks from your memories.",
    sameAs: [
      // Add social media links if available
      // "https://twitter.com/eveokee",
      // "https://instagram.com/eveokee",
    ],
  };
}

/**
 * Generate Website structured data for the homepage
 */
export function generateWebsiteStructuredData(
  baseUrl: string = typeof window !== "undefined" ? window.location.origin : "https://eveokee.com"
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "eveokee",
    url: baseUrl,
    description: "Turn your words into music. A journaling app that creates personalized soundtracks from your memories.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/blog?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

