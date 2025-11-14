/**
 * JSON-LD Structured Data components for SEO
 * Provides structured data for search engines using JSON-LD format
 */

import { BlogPost } from "@/lib/blog-service";

interface StructuredDataProps {
  data: Record<string, unknown>;
}

/**
 * Embed JSON-LD structured data into the page via a script[type="application/ld+json"] element.
 *
 * @param data - Object conforming to JSON-LD (e.g., schema.org) to be serialized into the script tag
 */
export function StructuredData({ data }: StructuredDataProps) {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe: content is JSON.stringify(data) for application/ld+json, not raw HTML/JS
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Create a JSON-LD BlogPosting object for a blog post.
 *
 * The returned object follows schema.org's BlogPosting structure and includes
 * headline, description, author, publisher, publication/modification dates,
 * canonical or generated URL, optional image, reading time, and keywords.
 *
 * @param post - The blog post to convert into structured data
 * @param baseUrl - Base site URL used to build absolute URLs; defaults to the current window origin when available or "https://eveokee.com"
 * @returns A JSON-LD object representing a schema.org `BlogPosting` for the provided post
 */
export function generateArticleStructuredData(
  post: BlogPost,
  baseUrl: string = typeof window !== "undefined" ? window.location.origin : "https://eveokee.com"
): Record<string, unknown> {
  const postUrl = post.slug ? `${baseUrl}/blog/${post.slug}` : baseUrl;
  const publishedDate = post.publishedAt 
    ? new Date(post.publishedAt).toISOString()
    : new Date(post._creationTime).toISOString();
  const modifiedDate = post.updatedAt
    ? new Date(post.updatedAt).toISOString()
    : publishedDate;

  // Prefer featuredImage, fall back to OG image, omit when canonical URL exists
  const image = post.canonicalUrl 
    ? undefined 
    : (post.featuredImage || `${baseUrl}/og-image.png`);

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || post.title,
    image,
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
 * Create a JSON-LD Blog object for the blog listing page.
 *
 * @param posts - Array of BlogPost items to include as `blogPost` entries; when included the list is limited to the first 10 posts.
 * @param baseUrl - Base URL used for item URLs and assets. Defaults to `window.location.origin` in browsers or `"https://eveokee.com"` in non-browser environments.
 * @returns A Record representing a schema.org `Blog` object. If `posts` is non-empty the object includes a `blogPost` array with up to 10 `BlogPosting` entries; otherwise `blogPost` is omitted.
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

  // Only include blogPost array if there are posts with slugs
  if (posts.length > 0) {
    const postsWithSlugs = posts.filter((post) => post.slug);
    if (postsWithSlugs.length > 0) {
      blogData.blogPost = postsWithSlugs.slice(0, 10).map((post) => ({
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
  }

  return blogData;
}

/**
 * Create schema.org Organization structured data for the site.
 *
 * @param baseUrl - Base URL used to construct the organization's `url` and `logo`; defaults to `window.location.origin` when available, otherwise `"https://eveokee.com"`.
 * @returns A JSON-LD object for an `Organization` containing `name`, `url`, `logo`, `description`, and a `sameAs` array for social links.
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
 * Create a JSON-LD WebSite structured data object for the site homepage.
 *
 * @param baseUrl - Base URL to use for generated URLs; defaults to window.location.origin when available or "https://eveokee.com".
 * @returns A JSON-LD object representing a schema.org WebSite, including site metadata and a SearchAction for blog search.
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
