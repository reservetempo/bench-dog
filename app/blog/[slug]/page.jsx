// /app/blog/[slug]/page.jsx

import { notFound } from 'next/navigation';
import { getPostBySlug } from '../../lib/blogStore';
import { CONTENT_CLASSES, renderMarkdown } from '../markdown';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const post = await getPostBySlug(params.slug).catch(() => null);
  return { title: post ? post.title : 'Post not found' };
}

export default async function BlogPostPage({ params }) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <main className="max-w-3xl mx-auto py-12 px-4">
        <a href="/blog" className="text-sm text-gray-500 hover:underline">← all posts</a>
        <h1 className="text-4xl font-bold mt-6">{post.title}</h1>
        <p className="text-sm text-gray-500 mt-2 mb-8">{post.date}</p>
        <article
          className={`text-lg ${CONTENT_CLASSES}`}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
        />
      </main>
    </div>
  );
}
