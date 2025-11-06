import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@backend/convex';
import { Id } from '@backend/convex/convex/_generated/dataModel';
import { Save, X, FileText, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { FilterType } from './NewDashboard';

export default function MemoryCompose() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  
  // Get the tab from URL to restore when navigating back
  const returnTab = (searchParams.get('tab') as FilterType) || 'songs';

  const diary = useQuery(
    api.diaries.listDiaries,
    isEditing ? {} : 'skip'
  );
  const currentDiary = isEditing && diary
    ? diary.find(d => d._id === id as Id<'diaries'>)
    : null;

  const createDiary = useMutation(api.diaries.createDiary);
  const updateDiary = useMutation(api.diaries.updateDiary);

  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load existing diary data when editing
  useEffect(() => {
    if (currentDiary) {
      setContent(currentDiary.content);
    }
  }, [currentDiary]);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('Content is required');
      return;
    }

    try {
      setIsSaving(true);

      if (isEditing && id) {
        await updateDiary({
          diaryId: id as Id<'diaries'>,
          content: content.trim(),
        });
        toast.success('Memory updated successfully');
      } else {
        await createDiary({
          content: content.trim(),
        });
        toast.success('Memory created successfully');
      }

      navigate(`/dashboard?tab=${returnTab}`);
    } catch (error) {
      console.error('Error saving memory:', error);
      toast.error('Failed to save memory. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/dashboard?tab=${returnTab}`);
  };

  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
  const estimatedReadTime = Math.ceil(wordCount / 200); // Average reading speed: 200 words/min

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Memory' : 'Create New Memory'}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {isEditing ? 'Update your memory' : 'Write and save your thoughts'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? 'Edit' : 'Preview'}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !content.trim()}
                className="px-6 py-2 text-sm font-medium text-white bg-accent-mint rounded-lg hover:bg-accent-mint/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {showPreview ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
            <article className="prose dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                {content}
              </div>
            </article>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Content
                </label>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {wordCount} words · ~{estimatedReadTime} min read
                </div>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your memory content here..."
                rows={20}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-accent-mint focus:border-transparent outline-none resize-none font-mono text-sm leading-relaxed"
                required
              />
            </div>

            {/* Help Text */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Tip:</p>
                  <p>
                    You can use Markdown syntax in your content.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

