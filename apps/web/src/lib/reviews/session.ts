import 'server-only';
import { cookies } from 'next/headers';
import type { Review } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function forwardedGet<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;

  const res = await fetch(`${API_URL}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function getReviews(tenantId: string): Promise<Review[]> {
  const result = await forwardedGet<{ reviews: Review[] }>(`/tenants/${tenantId}/reviews`);
  return result?.reviews ?? [];
}

export async function getReview(tenantId: string, reviewId: string): Promise<Review | null> {
  const result = await forwardedGet<{ review: Review }>(`/tenants/${tenantId}/reviews/${reviewId}`);
  return result?.review ?? null;
}
