// /app/blog/posts.js

// Starter posts, shown only until the first time a post is saved or deleted at /admin.
// After that, posts live in Cloudinary (blog_data/posts.json) and this file is no longer used.
export const SEED_POSTS = [
  {
    id: 'second-post',
    slug: 'second-post',
    title: 'Second Post',
    date: '2026-10-01',
    content: `
This is the second post.

- Lists work
- **Bold** and *italic* work too

> So do quotes.
`,
  },
  {
    id: 'first-post',
    slug: 'first-post',
    title: 'First Post',
    date: '2026-09-01',
    content: `
Hello! This is the first post on the blog.
`,
  },
];
