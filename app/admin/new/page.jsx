// /app/admin/new/page.jsx

import { redirect } from 'next/navigation';
import { isLoggedIn } from '../../lib/auth';
import PostEditor from '../PostEditor';

export default function NewPostPage() {
  if (!isLoggedIn()) redirect('/admin');
  return <PostEditor />;
}
