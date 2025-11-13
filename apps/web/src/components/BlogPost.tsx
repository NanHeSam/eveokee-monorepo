import { ArrowLeft, Calendar, Clock, User, Tag } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { BlogPost as BlogPostType } from '../lib/blog-service';
import { parseMusicShortcodes, parseYouTubeEmbeds, processMusicComponents } from '../utils/markdownUtils';
import { formatDate } from '../utils/formatting';

interface BlogPostProps {
  post: BlogPostType;
  onBack: () => void;
}

/**
 * Render a complete blog post view including header, metadata, tags and processed body content.
 *
 * The component displays the post title, author, optional publish date and reading time, tag pills,
 * and a back button that invokes `onBack`. The post body is preprocessed for line breaks, music
 * shortcodes, and YouTube embeds, then rendered as Markdown with support for syntax highlighting,
 * custom block components (e.g., music embeds), and styled HTML elements.
 *
 * @param post - The blog post data (title, author, publishedAt, readingTime, tags, and bodyMarkdown).
 * @param onBack - Callback invoked when the "Back to Blog" button is clicked.
 * @returns The JSX element representing the blog post view.
 */
export default function BlogPost({ post, onBack }: BlogPostProps) {

  return (
    <article className="max-w-4xl mx-auto px-4 py-8">
      <button 
        onClick={onBack}
        className="inline-flex items-center text-accent-mint hover:text-accent-mint/80 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Blog
      </button>
      
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
          {post.title}
        </h1>
        
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300 mb-4">
          <div className="flex items-center">
            <User className="w-4 h-4 mr-1" />
            {post.author}
          </div>
          {post.publishedAt && (
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              {formatDate(post.publishedAt, { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          )}
          {post.readingTime && (
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {post.readingTime} min read
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-3 py-1 bg-accent-mint/10 text-accent-mint text-sm rounded-full"
            >
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </span>
          ))}
        </div>
      </header>
      
      <div className="prose prose-lg max-w-none">
        {(() => {
          // Preprocess content: convert <br> and <br/> tags to newlines for markdown
          const contentWithLineBreaks = post.bodyMarkdown.replace(/<br\s*\/?>/gi, '\n\n');
          const processedContent = parseYouTubeEmbeds(parseMusicShortcodes(contentWithLineBreaks));
          const contentParts = processMusicComponents(processedContent);
          
          return contentParts.map((part, index) => {
            if (typeof part === 'string') {
              return (
                <ReactMarkdown
                  key={`markdown-${index}`}
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 mt-8 first:mt-0">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 mt-8">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-gray-800 dark:text-gray-200">{children}</em>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-outside mb-4 text-gray-700 dark:text-gray-300 ml-6 pl-2 space-y-2">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-outside mb-4 text-gray-700 dark:text-gray-300 ml-6 pl-2 space-y-2">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="mb-1 pl-2">{children}</li>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-6">
                        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                      <tr className="border-b border-gray-200 dark:border-gray-700">{children}</tr>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                        {children}
                      </td>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-accent-mint bg-accent-mint/5 dark:bg-accent-mint/10 pl-4 py-2 my-4 italic text-gray-700 dark:text-gray-300">
                        {children}
                      </blockquote>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className={className}>
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 dark:text-gray-200 p-4 rounded-lg overflow-x-auto my-4">
                        {children}
                      </pre>
                    ),
                    a: ({ href, children }) => (
                      <a 
                        href={href} 
                        className="text-accent-mint hover:text-accent-mint/80 underline transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                    img: ({ src, alt, title }) => (
                      <figure className="my-8">
                        <img
                          src={src}
                          alt={alt || ''}
                          title={title}
                          className="w-full rounded-lg shadow-md"
                        />
                        {alt && (
                          <figcaption className="mt-3 text-sm text-center text-gray-600 dark:text-gray-400 italic">
                            {alt}
                          </figcaption>
                        )}
                      </figure>
                    ),
                    hr: () => (
                      <div className="flex justify-center my-8">
                        <div className="w-16 h-px bg-gray-300 dark:bg-gray-600"></div>
                      </div>
                    ),
                  }}
                >
                  {part}
                </ReactMarkdown>
              );
            } else {
              // This is a React component (MusicEmbed)
              return part;
            }
          });
        })()}
      </div>
    </article>
  );
}