import { Calendar, Clock, User } from 'lucide-react';
import { BlogPost as BlogPostType } from '@/lib/blog-service';
import { formatDate } from '@/utils/formatting';

interface BlogListingProps {
  posts: BlogPostType[];
}

/**
 * Blog listing component that displays a list of blog posts
 * Used for both client-side rendering and SSR
 */
export default function BlogListing({ posts }: BlogListingProps) {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-accent-mint/10 to-accent-coral/10 dark:from-accent-mint/5 dark:to-accent-coral/5 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            The eveokee Blog
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Stories, insights, and updates from the journey of building something that turns your words into music.
          </p>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                No blog posts yet.
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {posts.map((post) => (
                <article 
                  key={post._id}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-8">
                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map((tag) => (
                          <span 
                            key={tag}
                            className="bg-accent-mint/10 dark:bg-accent-mint/20 text-accent-mint px-3 py-1 rounded-full text-sm font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Title */}
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                      {post.slug ? (
                        <a
                          href={`/blog/${post.slug}`}
                          className="hover:text-accent-mint transition-colors"
                        >
                          {post.title}
                        </a>
                      ) : (
                        <span>{post.title}</span>
                      )}
                    </h2>

                    {/* Excerpt */}
                    {post.excerpt && (
                      <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed mb-6">
                        {post.excerpt}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400 mb-6">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{post.author}</span>
                      </div>
                      {post.publishedAt && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(post.publishedAt, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                      )}
                      {post.readingTime && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{post.readingTime} min read</span>
                        </div>
                      )}
                    </div>

                    {/* Read More */}
                    {post.slug && (
                      <a
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center text-accent-mint hover:text-accent-mint/80 transition-colors font-medium"
                      >
                        Read full post →
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

