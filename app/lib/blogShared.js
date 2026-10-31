// /app/lib/blogShared.js

// Blog helpers used by both the editor (in the browser) and the server.

// Cloudinary folder for photos pasted into posts
export const IMAGE_FOLDER = 'blog_images';

// Fit the post column (at 2x for sharp screens) and let Cloudinary pick the best format
const IMAGE_TRANSFORM = 'f_auto,q_auto,c_limit,w_1600';

export const imageUrl = (cloudName, publicId) =>
  `https://res.cloudinary.com/${cloudName}/image/upload/${IMAGE_TRANSFORM}/${publicId}`;

// Cloudinary ids of the blog photos used in a post's markdown
export function findImageIds(markdown) {
  const pattern = new RegExp(`res\\.cloudinary\\.com/\\S*?/(${IMAGE_FOLDER}/[\\w-]+)`, 'g');
  return [...new Set([...String(markdown ?? '').matchAll(pattern)].map((match) => match[1]))];
}

// "My First Post!" -> "my-first-post"
export function slugify(text) {
  const slug = String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '');
  return slug || 'post';
}
