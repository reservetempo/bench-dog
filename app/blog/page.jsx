// /app/blog/page.jsx

import { getPosts } from '../lib/blogStore';

// Posts can change at any time from /admin, so render on each request (the data itself is cached)
export const dynamic = 'force-dynamic';

export default async function BlogPage() {
  let posts = [];
  let failed = false;
  try {
    posts = await getPosts();
  } catch (err) {
    console.error(err.message);
    failed = true;
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <main className="max-w-3xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-8">blog</h1>
        {failed && <p className="text-gray-500">Couldn&apos;t load posts right now.</p>}
        {!failed && posts.length === 0 && <p className="text-gray-500">No posts yet.</p>}
        <ul>
          {posts.map((post) => (
            <li key={post.id} className="border-b border-gray-200">
              <a href={`/blog/${post.slug}`} className="flex justify-between items-baseline gap-4 py-4 hover:underline">
                <span className="text-2xl">{post.title}</span>
                <span className="text-sm text-gray-500 shrink-0">{post.date}</span>
              </a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
