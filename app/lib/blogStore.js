// /app/lib/blogStore.js

// Blog posts are stored as one JSON file in Cloudinary (blog_data/posts.json), next to the photos.
// Server only: this uses the Cloudinary API secret.

import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { unstable_cache, revalidateTag } from 'next/cache';
import { SEED_POSTS } from '../blog/posts';
import { IMAGE_FOLDER, findImageIds, slugify } from './blogShared';

const POSTS_FILE = 'blog_data/posts.json';
const CACHE_TAG = 'blog-posts';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Cloudinary error objects include the API secret, so only ever pass on the message
const errorMessage = (err) => err?.error?.message || err?.message || 'unknown error';

const newestFirst = (a, b) =>
  b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? '');

// Always reads the latest file from Cloudinary
async function readPostsFresh() {
  let file;
  try {
    file = await cloudinary.api.resource(POSTS_FILE, { resource_type: 'raw' });
  } catch (err) {
    // Nothing saved yet: start with the starter posts
    if (err?.error?.http_code === 404) return [...SEED_POSTS].sort(newestFirst);
    throw new Error(`Could not load posts: ${errorMessage(err)}`);
  }
  // The URL includes the file's version number, so a cached copy is never stale
  const res = await fetch(file.secure_url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Could not load posts (HTTP ${res.status})`);
  return res.json();
}

// Cached copy for page views, cleared whenever a post is saved or deleted
export const getPosts = unstable_cache(readPostsFresh, ['blog-posts'], {
  tags: [CACHE_TAG],
  revalidate: 3600,
});

export async function getPostBySlug(slug) {
  return (await getPosts()).find((post) => post.slug === slug) ?? null;
}

export async function getPostById(id) {
  return (await getPosts()).find((post) => post.id === id) ?? null;
}

async function writePosts(posts) {
  try {
    await new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', public_id: POSTS_FILE, overwrite: true, invalidate: true },
        (err, result) => (err ? reject(err) : resolve(result)),
      );
      upload.end(Buffer.from(JSON.stringify(posts, null, 2)));
    });
  } catch (err) {
    throw new Error(`Could not save: ${errorMessage(err)}`);
  }
  revalidateTag(CACHE_TAG);
}

// Delete photos that were in a post but no longer appear in any post
async function deleteUnusedImages(oldContent, posts) {
  const inUse = new Set(posts.flatMap((post) => findImageIds(post.content)));
  const unused = findImageIds(oldContent).filter((id) => !inUse.has(id));
  if (!unused.length) return;
  try {
    await cloudinary.api.delete_resources(unused);
  } catch (err) {
    console.error('Could not delete unused blog photos:', errorMessage(err));
  }
}

function uniqueSlug(base, otherPosts) {
  let slug = base;
  for (let n = 2; otherPosts.some((post) => post.slug === slug); n++) slug = `${base}-${n}`;
  return slug;
}

const isDate = (text) => /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text));

// Creates a post (no id) or updates one. Throws an Error with a readable message on bad input.
export async function savePostToStore({ id, title, slug, date, content }) {
  title = String(title ?? '').trim();
  if (!title) throw new Error('Give the post a title first.');
  if (!isDate(date)) throw new Error('Pick a date for the post.');

  const posts = await readPostsFresh();
  const existing = id ? posts.find((post) => post.id === id) : null;
  if (id && !existing) throw new Error('This post has been deleted.');

  const others = posts.filter((post) => post !== existing);
  const now = new Date().toISOString();
  const saved = {
    ...(existing ?? { id: crypto.randomBytes(6).toString('hex'), createdAt: now }),
    title,
    slug: uniqueSlug(slugify(slug || title), others),
    date,
    content: String(content ?? ''),
    updatedAt: now,
  };

  const updated = [...others, saved].sort(newestFirst);
  await writePosts(updated);
  if (existing) await deleteUnusedImages(existing.content, updated);
  return saved;
}

export async function deletePostFromStore(id) {
  const posts = await readPostsFresh();
  const post = posts.find((p) => p.id === id);
  if (!post) return; // already gone

  const remaining = posts.filter((p) => p !== post);
  await writePosts(remaining);
  await deleteUnusedImages(post.content, remaining);
}

// Lets the editor upload a photo straight from the browser to Cloudinary (valid for 1 hour)
export function signImageUpload() {
  const fields = { timestamp: Math.round(Date.now() / 1000), folder: IMAGE_FOLDER };
  const signature = cloudinary.utils.api_sign_request(fields, process.env.CLOUDINARY_API_SECRET);
  return {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    fields: { ...fields, signature, api_key: process.env.CLOUDINARY_API_KEY },
  };
}
