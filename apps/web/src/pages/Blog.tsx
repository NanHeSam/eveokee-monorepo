import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, Search } from 'lucide-react';
import BlogPost from '@/components/BlogPost';
import { getAllPosts, getPostBySlug, getDraftByPreviewToken, trackView, BlogPost as BlogPostType } from '@/lib/blog-service';
import { formatDate } from '@/utils/formatting';

export default function Blog() {
  const { slug, token } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [posts, setPosts] = useState<BlogPostType[]>([]);
  const [currentPost, setCurrentPost] = useState<BlogPostType | null>(null);
  const [loading, setLoading] = useState(true);
  
  const handleBackToBlog = () => {
    navigate('/blog');
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Check if this is a draft preview (path: /blog/preview/:token)
        if (token) {
          const post = await getDraftByPreviewToken(token);
          setCurrentPost(post || null);
        } else if (slug) {
          const post = await getPostBySlug(slug);
          setCurrentPost(post || null);
          
          // Track view if post exists
          if (post) {
            trackView(post._id).catch(err => 
              console.error('Failed to track view:', err)
            );
          }
        } else {
          const allPosts = await getAllPosts();
          setPosts(allPosts);
        }
      } catch (error) {
        console.error('Error loading blog data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [slug, token]);
  
  // If we have a post (from slug or preview token), show individual blog post
  if (slug || token) {
    if (loading) {
      return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      );
    }
    
    if (!currentPost) {
      return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {token ? 'Draft Not Found' : 'Post Not Found'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            {token 
              ? 'The draft you\'re looking for doesn\'t exist or has already been published.'
              : 'The blog post you\'re looking for doesn\'t exist.'}
          </p>
          <Link 
            to="/blog" 
            className="bg-accent-mint text-white px-6 py-3 rounded-lg font-medium hover:bg-accent-mint/90 transition-colors"
          >
            Back to Blog
          </Link>
        </div>
      );
    }

    return (
      <div>
        {token && (
          <div className="bg-yellow-100 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 mb-6">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                📝 Draft Preview - This post is not yet published
              </p>
            </div>
          </div>
        )}
        <BlogPost post={currentPost} onBack={handleBackToBlog} />
      </div>
    );
  }

  // Show blog listing
  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.excerpt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-8 space-y-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
          
          {/* Search Bar */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-accent-mint focus:border-transparent outline-none"
            />
          </div>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                {searchTerm ? 'No posts found matching your search.' : 'No blog posts yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {filteredPosts.map((post) => (
                <article 
                  key={post._id}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-8">
                    {/* Tags */}
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

                    {/* Title */}
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                      {post.slug ? (
                        <Link
                          to={`/blog/${post.slug}`}
                          className="hover:text-accent-mint transition-colors"
                        >
                          {post.title}
                        </Link>
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
                      <Link
                        to={`/blog/${post.slug}`}
                        className="inline-flex items-center text-accent-mint hover:text-accent-mint/80 transition-colors font-medium"
                      >
                        Read full post →
                      </Link>
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
