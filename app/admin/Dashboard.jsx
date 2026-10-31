// /app/admin/Dashboard.jsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deletePost, logout } from './actions';

export default function Dashboard({ posts, loadError }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(loadError);

  const onDelete = async (post) => {
    if (!window.confirm(`Delete "${post.title}"?\n\nThis can't be undone.`)) return;
    setDeletingId(post.id);
    setError('');
    const result = await deletePost(post.id).catch(() => ({ error: 'Could not reach the server.' }));
    setDeletingId(null);
    if (result?.error) setError(result.error);
    else router.refresh();
  };

  const onLogout = async () => {
    await logout();
    router.refresh();
  };

  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-4xl font-bold">posts</h1>
        <div className="flex items-center gap-5 text-sm">
          <a href="/blog" className="text-gray-500 hover:underline">blog ↗</a>
          <button type="button" onClick={onLogout} className="text-gray-500 hover:underline">log out</button>
          <Link href="/admin/new" className="bg-black text-white px-4 py-2">new post</Link>
        </div>
      </div>

      {error && <p className="mb-6 text-sm text-red-600">{error}</p>}
      {!error && posts.length === 0 && <p className="text-gray-500">No posts yet.</p>}

      <ul>
        {posts.map((post) => (
          <li
            key={post.id}
            className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-gray-200 py-4 ${deletingId === post.id ? 'opacity-40' : ''}`}
          >
            <Link href={`/admin/edit/${post.id}`} className="min-w-0 text-2xl hover:underline">
              {post.title}
            </Link>
            <div className="flex shrink-0 items-baseline gap-4 text-sm text-gray-500">
              <span>{post.date}</span>
              <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="hover:underline">view</a>
              <Link href={`/admin/edit/${post.id}`} className="hover:underline">edit</Link>
              <button
                type="button"
                onClick={() => onDelete(post)}
                disabled={deletingId !== null}
                className="hover:text-red-600 hover:underline"
              >
                delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
