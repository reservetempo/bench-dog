// /app/blog/markdown.js

import { marked } from 'marked';

// Tailwind's preflight strips default heading/list styles, so restore the basics for rendered markdown
export const CONTENT_CLASSES = [
  '[&_h1]:text-4xl [&_h1]:font-bold [&_h1]:my-4',
  '[&_h2]:text-3xl [&_h2]:font-bold [&_h2]:my-3',
  '[&_h3]:text-2xl [&_h3]:font-bold [&_h3]:my-2',
  '[&_p]:my-3',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_a]:underline',
  '[&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic',
  '[&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded',
  '[&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:my-3 [&_pre]:overflow-x-auto',
  '[&_img]:max-w-full [&_img]:my-4',
  '[&_hr]:my-6',
].join(' ');

export function renderMarkdown(markdown) {
  return marked.parse(markdown ?? '').replace(/<img /g, '<img loading="lazy" ');
}
