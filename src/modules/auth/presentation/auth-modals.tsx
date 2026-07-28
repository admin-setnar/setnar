'use client';

import dynamic from 'next/dynamic';

import { useAuthModal } from '@/modules/auth/presentation/hooks/use-auth-modal';

/**
 * AuthModals
 *
 * Purpose: mount the authentication dialogs once, at the root, so any trigger
 * on the page can open them.
 * Performance: each modal — with its form, resolver and schema — is loaded on
 * first open, keeping react-hook-form and zod out of the initial bundle of a
 * page most visitors will only scroll.
 * Behaviour: once a modal has been opened it stays mounted, so its exit
 * animation can play and typed input survives an accidental close.
 */
const SignInModal = dynamic(
  () => import('@/modules/auth/presentation/sign-in-modal').then((mod) => mod.SignInModal),
  { ssr: false },
);

const SignUpModal = dynamic(
  () => import('@/modules/auth/presentation/sign-up-modal').then((mod) => mod.SignUpModal),
  { ssr: false },
);

export function AuthModals() {
  const { view, mountedViews } = useAuthModal();

  return (
    <>
      {mountedViews.includes('sign-in') ? <SignInModal open={view === 'sign-in'} /> : null}
      {mountedViews.includes('sign-up') ? <SignUpModal open={view === 'sign-up'} /> : null}
    </>
  );
}
