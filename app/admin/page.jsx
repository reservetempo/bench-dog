// /app/admin/page.jsx

import { isLoggedIn } from '../lib/auth';
import { getPosts } from '../lib/blogStore';
import LoginForm from './LoginForm';
import Dashboard from './Dashboard';

export default async function AdminPage() {
  if (!isLoggedIn()) return <LoginForm />;

  let posts = [];
  let loadError = '';
  try {
    posts = await getPosts();
  } catch (err) {
    loadError = err.message;
  }
  return <Dashboard posts={posts} loadError={loadError} />;
}
