// /app/admin/actions.js
'use server';

import { checkPassword, endSession, isLoggedIn, startSession } from '../lib/auth';
import { deletePostFromStore, savePostToStore, signImageUpload } from '../lib/blogStore';

const LOGGED_OUT = { error: 'You were logged out. Log in again at /admin in a new tab, then try again here.' };

export async function login(password) {
  if (!process.env.ADMIN_PASSWORD) return { error: 'ADMIN_PASSWORD is not set on the server.' };
  if (!checkPassword(password ?? '')) {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // slow down password guessing
    return { error: 'Wrong password.' };
  }
  startSession();
  return { ok: true };
}

export async function logout() {
  endSession();
  return { ok: true };
}

export async function savePost(input) {
  if (!isLoggedIn()) return LOGGED_OUT;
  try {
    return { post: await savePostToStore(input) };
  } catch (err) {
    return { error: err.message };
  }
}

export async function deletePost(id) {
  if (!isLoggedIn()) return LOGGED_OUT;
  try {
    await deletePostFromStore(id);
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
}

export async function getUploadSignature() {
  if (!isLoggedIn()) return LOGGED_OUT;
  return signImageUpload();
}
