// /app/admin/edit/[id]/page.jsx

import { notFound, redirect } from 'next/navigation';
import { isLoggedIn } from '../../../lib/auth';
import { getPostById } from '../../../lib/blogStore';
import PostEditor from '../../PostEditor';

export default async function EditPostPage({ params }) {
  if (!isLoggedIn()) redirect('/admin');
  const post = await getPostById(params.id);
  if (!post) notFound();
  return <PostEditor post={post} />;
}
