// /app/admin/PostEditor.jsx
'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getUploadSignature, savePost } from './actions';
import { imageUrl, slugify } from '../lib/blogShared';
import { CONTENT_CLASSES, renderMarkdown } from '../blog/markdown';

// --- Post body <-> blocks ---
// While editing, the body is a list of blocks: text boxes (markdown) with photos between them.
// It's saved as plain markdown, with each photo on its own line: ![](url)

let lastKey = 0;
const newKey = () => `block-${++lastKey}`;
const textBlock = (text = '') => ({ key: newKey(), type: 'text', text });

const IMAGE_LINE = /^\s*!\[([^\]]*)\]\((\S+?)\)\s*$/;

// Drop blank lines at the start and whitespace at the end
const trimEnds = (text) => text.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '');

function joinText(a, b) {
  if (!a.trim()) return b;
  if (!b.trim()) return a;
  return `${trimEnds(a)}\n\n${trimEnds(b)}`;
}

// Merge text boxes that end up next to each other, and keep a text box before, between and after photos
function normalize(blocks) {
  const result = [];
  for (const block of blocks) {
    const last = result[result.length - 1];
    if (block.type === 'text' && last?.type === 'text') {
      result[result.length - 1] = { ...last, text: joinText(last.text, block.text) };
    } else {
      if (block.type !== 'text' && last?.type !== 'text') result.push(textBlock());
      result.push(block);
    }
  }
  if (result[result.length - 1]?.type !== 'text') result.push(textBlock());
  return result;
}

function fromMarkdown(markdown) {
  const blocks = [];
  let lines = [];
  const flush = () => {
    blocks.push(textBlock(trimEnds(lines.join('\n'))));
    lines = [];
  };
  for (const line of String(markdown ?? '').split(/\r?\n/)) {
    const match = line.match(IMAGE_LINE);
    if (match) {
      flush();
      blocks.push({ key: newKey(), type: 'image', alt: match[1], url: match[2] });
    } else {
      lines.push(line);
    }
  }
  flush();
  return normalize(blocks);
}

function toMarkdown(blocks) {
  return blocks
    .map((block) => {
      if (block.type === 'text') return trimEnds(block.text);
      if (block.type === 'image') return `![${block.alt}](${block.url})`;
      return ''; // still uploading
    })
    .filter((part) => part.trim())
    .join('\n\n');
}

// --- Photo uploads ---

const isImage = (file) => file.type.startsWith('image/');
const MAX_UPLOAD_BYTES = 9.5 * 1024 * 1024; // Cloudinary's free plan rejects photos over 10 MB

// Very large photos are scaled down in the browser before uploading
async function shrinkIfHuge(file) {
  if (file.size <= MAX_UPLOAD_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 3200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}

// Uploads straight to Cloudinary, using a signature from the server
async function uploadPhoto(file) {
  const auth = await getUploadSignature();
  if (auth.error) throw new Error(auth.error);

  const form = new FormData();
  form.append('file', await shrinkIfHuge(file));
  Object.entries(auth.fields).forEach(([name, value]) => form.append(name, value));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${auth.cloudName}/image/upload`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `upload failed (HTTP ${res.status})`);
  return imageUrl(auth.cloudName, data.public_id);
}

// Wait for the uploaded copy to load so the photo doesn't flicker when it replaces the local preview
const preload = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = resolve;
    img.src = url;
  });

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// --- Components ---

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// A textarea that grows to fit its text
function AutoTextarea({ inputRef, value, ...props }) {
  const ref = useRef(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const scrollY = window.scrollY; // shrinking to measure can make the page jump
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    window.scrollTo(window.scrollX, scrollY);
  }, []);

  useIsomorphicLayoutEffect(fit, [value, fit]);
  useEffect(() => {
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);

  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        inputRef?.(el);
      }}
      rows={1}
      value={value}
      {...props}
    />
  );
}

export default function PostEditor({ post }) {
  const [postId, setPostId] = useState(post?.id ?? null);
  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(post));
  const [date, setDate] = useState(post?.date ?? '');
  const [blocks, setBlocksState] = useState(() => fromMarkdown(post?.content));
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [savedSlug, setSavedSlug] = useState(post?.slug ?? null);
  const [error, setError] = useState('');

  const blocksRef = useRef(blocks);
  const revision = useRef(0);
  const textareas = useRef(new Map());
  const caret = useRef(null); // where the cursor was last, so "add photo" knows where to put it
  const pendingFocus = useRef(null); // where to put the cursor after the next render
  const fileInput = useRef(null);

  // Keep a ref in sync so async uploads always update the latest blocks
  const setBlocks = useCallback((update) => {
    const next = typeof update === 'function' ? update(blocksRef.current) : update;
    blocksRef.current = next;
    setBlocksState(next);
  }, []);

  const markDirty = useCallback(() => {
    revision.current += 1;
    setDirty(true);
    setJustSaved(false);
  }, []);

  const uploading = blocks.some((block) => block.type === 'uploading');
  const unsaved = dirty || uploading;
  const shownSlug = slugEdited ? slug : title.trim() ? slugify(title) : '';

  // New posts default to today (set here so it uses your timezone, not the server's)
  useEffect(() => setDate((current) => current || today()), []);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const el = textareas.current.get(target.key);
    if (el) {
      el.focus();
      el.setSelectionRange(target.pos, target.pos);
    }
  }, [blocks]);

  // Split the text box at the cursor and put the photos in between
  const insertPhotos = useCallback(
    (fileList, at) => {
      const files = [...(fileList ?? [])].filter(isImage);
      if (!files.length) return;

      const current = blocksRef.current;
      let index = at ? current.findIndex((block) => block.key === at.key && block.type === 'text') : -1;
      if (index === -1) {
        index = current.length - 1; // end of the post (always a text box)
        const end = current[index].text.length;
        at = { start: end, end };
      }
      const target = current[index];
      const placeholders = files.map((file) => ({ key: newKey(), type: 'uploading', previewUrl: URL.createObjectURL(file) }));
      const after = textBlock(target.text.slice(at.end).replace(/^\s+/, ''));
      pendingFocus.current = { key: after.key, pos: 0 };

      setBlocks(
        normalize([
          ...current.slice(0, index),
          { ...target, text: target.text.slice(0, at.start).replace(/\s+$/, '') },
          ...placeholders.flatMap((placeholder, i) => (i ? [textBlock(), placeholder] : [placeholder])),
          after,
          ...current.slice(index + 1),
        ]),
      );
      markDirty();
      setError('');

      placeholders.forEach((placeholder, i) => {
        uploadPhoto(files[i])
          .then(async (url) => {
            await preload(url);
            setBlocks((prev) =>
              prev.map((block) => (block.key === placeholder.key ? { key: block.key, type: 'image', alt: '', url } : block)),
            );
          })
          .catch((err) => {
            setBlocks((prev) => normalize(prev.filter((block) => block.key !== placeholder.key)));
            setError(`A photo didn't upload: ${err.message}`);
          })
          .finally(() => URL.revokeObjectURL(placeholder.previewUrl));
      });
    },
    [setBlocks, markDirty],
  );

  const rememberCaret = (event, block) => {
    caret.current = { key: block.key, start: event.target.selectionStart, end: event.target.selectionEnd };
  };

  const onTextChange = (event, block) => {
    const { value } = event.target;
    setBlocks((prev) => prev.map((b) => (b.key === block.key ? { ...b, text: value } : b)));
    rememberCaret(event, block);
    markDirty();
  };

  const onPaste = (event, block) => {
    const files = [...event.clipboardData.files].filter(isImage);
    if (!files.length) return;
    // Word and similar apps also put a picture of copied text on the clipboard: paste the text in that case
    const text = event.clipboardData.getData('text/plain').trim();
    if (text && !/^(https?:|data:image\/)\S*$/i.test(text)) return;

    event.preventDefault();
    const el = event.currentTarget;
    insertPhotos(files, { key: block.key, start: el.selectionStart, end: el.selectionEnd });
  };

  const onDrop = (event, block) => {
    const files = [...event.dataTransfer.files].filter(isImage);
    if (!files.length) return;
    event.preventDefault();
    const el = event.currentTarget;
    const hasCaret = document.activeElement === el;
    const start = hasCaret ? el.selectionStart : block.text.length;
    insertPhotos(files, { key: block.key, start, end: hasCaret ? el.selectionEnd : start });
  };

  const removePhoto = (key) => {
    setBlocks((prev) => normalize(prev.filter((block) => block.key !== key)));
    markDirty();
  };

  const save = async () => {
    if (saving || uploading) return;
    setSaving(true);
    setError('');
    const revisionAtSave = revision.current;
    const result = await savePost({
      id: postId,
      title,
      slug: shownSlug,
      date,
      content: toMarkdown(blocksRef.current),
    }).catch(() => ({ error: 'Could not reach the server. Your changes are still here, try again.' }));
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    const saved = result.post;
    if (!postId) window.history.replaceState(null, '', `/admin/edit/${saved.id}`);
    setPostId(saved.id);
    setSlug(saved.slug);
    setSlugEdited(true);
    setSavedSlug(saved.slug);
    if (revision.current === revisionAtSave) {
      setDirty(false);
      setJustSaved(true);
    }
  };

  // Ctrl+S / Cmd+S saves
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Photos dropped anywhere else on the page go where the cursor was last (instead of the browser opening the file)
  useEffect(() => {
    const hasFiles = (event) => event.dataTransfer?.types?.includes('Files');
    const onDragOver = (event) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const onWindowDrop = (event) => {
      if (!hasFiles(event) || event.defaultPrevented) return;
      event.preventDefault();
      insertPhotos(event.dataTransfer.files, caret.current);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onWindowDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onWindowDrop);
    };
  }, [insertPhotos]);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const confirmLeave = (event) => {
    if (unsaved && !window.confirm('Leave without saving your changes?')) event.preventDefault();
  };

  let status = '';
  if (uploading) status = 'uploading photo…';
  else if (saving) status = 'saving…';
  else if (dirty) status = 'unsaved changes';
  else if (justSaved) status = 'saved';

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="max-w-3xl mx-auto flex items-center gap-4 px-4 py-3 text-sm">
          <Link href="/admin" onClick={confirmLeave} className="text-gray-500 hover:underline">← posts</Link>
          <span className="min-w-0 flex-1 truncate text-gray-500">{status}</span>
          {savedSlug && (
            <a href={`/blog/${savedSlug}`} target="_blank" rel="noreferrer" className="text-gray-500 hover:underline">view ↗</a>
          )}
          <button type="button" onClick={() => setPreviewing((p) => !p)} className="text-gray-500 hover:underline">
            {previewing ? 'edit' : 'preview'}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || uploading}
            className="bg-black px-4 py-1.5 text-white disabled:opacity-40"
          >
            save
          </button>
        </div>
        {error && <p className="max-w-3xl mx-auto px-4 pb-3 text-sm text-red-600">{error}</p>}
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-40">
        {previewing ? (
          <>
            <h1 className="text-4xl font-bold mt-6">{title.trim() || 'Untitled'}</h1>
            <p className="text-sm text-gray-500 mt-2 mb-8">{date}</p>
            <article
              className={`text-lg ${CONTENT_CLASSES}`}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(toMarkdown(blocks)) }}
            />
          </>
        ) : (
          <>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                markDirty();
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                textareas.current.get(blocks[0].key)?.focus();
              }}
              placeholder="Title"
              aria-label="Title"
              className="w-full text-4xl font-bold outline-none placeholder:text-gray-300"
            />
            <div className="mt-3 mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  markDirty();
                }}
                aria-label="Date"
                className="bg-transparent outline-none"
              />
              <label className="flex min-w-[12rem] flex-1 items-center">
                <span>/blog/</span>
                <input
                  value={shownSlug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'));
                    setSlugEdited(true);
                    markDirty();
                  }}
                  placeholder="post-url"
                  aria-label="Post URL"
                  className="min-w-0 flex-1 border-b border-transparent bg-transparent outline-none focus:border-gray-300"
                />
              </label>
            </div>

            <div className="space-y-3">
              {blocks.map((block, i) => {
                if (block.type === 'text') {
                  return (
                    <AutoTextarea
                      key={block.key}
                      inputRef={(el) => {
                        if (el) textareas.current.set(block.key, el);
                        else textareas.current.delete(block.key);
                      }}
                      value={block.text}
                      onChange={(e) => onTextChange(e, block)}
                      onSelect={(e) => rememberCaret(e, block)}
                      onPaste={(e) => onPaste(e, block)}
                      onDrop={(e) => onDrop(e, block)}
                      placeholder={
                        i === 0 ? 'Start writing. Paste photos anywhere with Ctrl+V.' : i === blocks.length - 1 ? 'keep writing…' : ''
                      }
                      aria-label="Post text"
                      className={`block w-full resize-none overflow-hidden bg-transparent text-lg leading-relaxed outline-none placeholder:text-gray-300 ${
                        block.text ? '' : 'hover:bg-gray-50'
                      }`}
                    />
                  );
                }
                return (
                  <figure key={block.key} className="group relative w-fit max-w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={block.type === 'image' ? block.url : block.previewUrl}
                      alt={block.alt ?? ''}
                      className={`block max-w-full ${block.type === 'uploading' ? 'opacity-40' : ''}`}
                    />
                    {block.type === 'uploading' ? (
                      <figcaption className="absolute inset-0 flex items-center justify-center text-sm">uploading…</figcaption>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removePhoto(block.key)}
                        aria-label="Remove photo"
                        title="Remove photo"
                        className="absolute right-2 top-2 h-8 w-8 rounded-full bg-black/70 text-lg leading-none text-white focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      >
                        ×
                      </button>
                    )}
                  </figure>
                );
              })}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="border border-gray-300 px-3 py-1.5 text-black hover:bg-gray-50"
              >
                + add photo
              </button>
              <span>
                Paste or drop photos anywhere in the text. Markdown works: **bold**, *italic*, # heading, - list,
                [link](https://…).
              </span>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  insertPhotos(e.target.files, caret.current);
                  e.target.value = '';
                }}
              />
            </div>
          </>
        )}
      </main>
    </>
  );
}
