'use client';

import { apiFetch } from '../api/client';
import type { AuthUser } from './types';

export function signUp(input: { email: string; password: string; name: string }) {
  return apiFetch<{ user: AuthUser }>('/auth/sign-up', { method: 'POST', body: input });
}

export function signIn(input: { email: string; password: string }) {
  return apiFetch<{ user: AuthUser }>('/auth/sign-in', { method: 'POST', body: input });
}

export function signOut() {
  return apiFetch<void>('/auth/sign-out', { method: 'POST' });
}

export function requestPasswordReset(input: { email: string }) {
  return apiFetch<void>('/auth/request-password-reset', { method: 'POST', body: input });
}

export function resetPassword(input: { token: string; newPassword: string }) {
  return apiFetch<void>('/auth/reset-password', { method: 'POST', body: input });
}

export function acceptInvite(input: { token: string; name: string; password: string }) {
  return apiFetch<{ user: AuthUser }>('/auth/accept-invite', { method: 'POST', body: input });
}
