/**
 * Component to manage head tags (title, meta, links) dynamically
 * Uses React's useEffect to update document head
 */

import { useEffect } from "react";

interface HeadProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
}

/**
 * Manage document head metadata (title, meta description, canonical link, and Open Graph image) from the provided props.
 *
 * When `title` is provided, replaces `document.title` and restores the previous title when the component unmounts or `title` changes.
 * When `description` is provided, creates or updates the page meta description and leaves it set (no automatic restoration).
 * When `canonicalUrl` is provided, creates or updates a `link[rel="canonical"]` element with the given href.
 * When `ogImage` is provided, creates or updates a `meta[property="og:image"]` element with the given content.
 *
 * @param title - The document title to set
 * @param description - The content for the meta description tag
 * @param canonicalUrl - The URL to set on a `link[rel="canonical"]` element
 * @param ogImage - The URL to set on a `meta[property="og:image"]` element
 * @returns Null; this component does not render any DOM nodes
 */
export function Head({
  title,
  description,
  canonicalUrl,
  ogImage,
}: HeadProps) {
  useEffect(() => {
    // Update title
    if (title) {
      const originalTitle = document.title;
      document.title = title;
      return () => {
        document.title = originalTitle;
      };
    }
  }, [title]);

  useEffect(() => {
    // Update or create meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (description) {
      if (!metaDescription) {
        metaDescription = document.createElement("meta");
        metaDescription.setAttribute("name", "description");
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute("content", description);
    }

    return () => {
      // Cleanup: restore original description if needed
      // For now, we'll leave it as is since it's a global change
    };
  }, [description]);

  useEffect(() => {
    // Update or create canonical link
    if (canonicalUrl) {
      let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute("href", canonicalUrl);
    }
  }, [canonicalUrl]);

  useEffect(() => {
    // Update or create OG image
    if (ogImage) {
      let ogImageMeta = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
      if (!ogImageMeta) {
        ogImageMeta = document.createElement("meta");
        ogImageMeta.setAttribute("property", "og:image");
        document.head.appendChild(ogImageMeta);
      }
      ogImageMeta.setAttribute("content", ogImage);
    }
  }, [ogImage]);

  // RSS link is already in index.html, so we don't need to manage it here
  // But we could add it dynamically if needed

  return null; // This component doesn't render anything
}
