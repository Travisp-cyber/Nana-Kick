'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useMemo } from 'react';
import { useIframeSdk } from '@whop/react';

export default function PlansPage() {
  const router = useRouter();
  const iframeSdk = useIframeSdk();
  const [error, setError] = useState<string | null>(null);

  const isEmbedded = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.parent !== window;
  }, []);

  // Open Whop checkout in a centered popup window. Fallback to a normal navigation
  // if the popup is blocked by the browser or the URL is missing.
  const openCheckout = useCallback((url?: string) => {
    if (!url) {
      router.push('/plans');
      return;
    }

    const width = 520;
    const height = 720;
    const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
    const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
    const screenWidth = window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;
    const screenHeight = window.innerHeight ?? document.documentElement.clientHeight ?? screen.height;
    const left = dualScreenLeft + (screenWidth - width) / 2;
    const top = dualScreenTop + (screenHeight - height) / 2;

    let win: Window | null = null
    try {
      // Use _blank to maximize compatibility when inside an iframe (e.g. Whop)
      win = window.open(
        url,
        '_blank',
        `scrollbars=yes,resizable=yes,width=${width},height=${height},top=${top},left=${left},noopener=yes,noreferrer=yes`
      );
    } catch {}

    if (!win) {
      // Some browsers block window.open from third‑party iframes.
      // Fallback: synthetic anchor click with target=_blank which is more reliable.
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, [router]);

  const STARTER_PLAN_ID = process.env.NEXT_PUBLIC_WHOP_PLAN_STARTER_ID;
  const CREATOR_PLAN_ID = process.env.NEXT_PUBLIC_WHOP_PLAN_CREATOR_ID;
  const PRO_PLAN_ID = process.env.NEXT_PUBLIC_WHOP_PLAN_PRO_ID;
  const BRAND_PLAN_ID = process.env.NEXT_PUBLIC_WHOP_PLAN_BRAND_ID;

  const STARTER_URL = process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STARTER_URL;
  const CREATOR_URL = process.env.NEXT_PUBLIC_WHOP_CHECKOUT_CREATOR_URL;
  const PRO_URL = process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_URL;
  const BRAND_URL = process.env.NEXT_PUBLIC_WHOP_CHECKOUT_BRAND_URL;

  async function handlePurchase(planId: string | undefined, fallbackUrl?: string) {
    setError(null);

    // Prefer in-iframe purchase if embedded and we have a planId
    if (isEmbedded && planId) {
      try {
        const res = await iframeSdk.inAppPurchase({ planId });
        if (res.status !== 'ok') {
          setError(res.error || 'Purchase failed');
        }
        return;
      } catch (e: unknown) {
        console.error('inAppPurchase error:', e);
        const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message) : 'Purchase failed';
        setError(message);
        // Fall through to hosted checkout as a backup
      }
    }

    // Fallback: hosted checkout URL in new tab/window
    openCheckout(fallbackUrl);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <h1
            className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 bg-clip-text text-transparent"
            style={{ fontFamily: 'var(--font-fredoka)' }}
          >
            Plans
          </h1>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-300 hover:text-white border border-white/10 rounded-full px-4 py-2"
          >
            Back
          </button>
        </div>

        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">Your words. Your vision. Instantly edited</h2>
          <p className="text-gray-400">Choose the perfect plan to power your AI image generation</p>
        </div>

        {/* Pricing grid */}
        <div className="grid md:grid-cols-4 gap-6">
          {/* Starter */}
          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-8 flex flex-col">
            <div className="mb-6">
              <h3 className="text-2xl font-semibold">Starter</h3>
              <p className="text-sm text-gray-400">Perfect for trying it out</p>
            </div>
            <div className="mb-6">
              <p className="text-5xl font-bold">$9</p>
              <p className="text-gray-400">per month</p>
            </div>
            <ul className="space-y-3 text-sm text-gray-300 mb-8">
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Premium AI models</li>
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Priority support</li>
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Faster response time</li>
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Custom prompts</li>
            </ul>
            <Link
              href={STARTER_URL || '#'}
              onClick={(e) => { e.preventDefault(); handlePurchase(STARTER_PLAN_ID, STARTER_URL || undefined); }}
              className="mt-auto text-center bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl py-3 transition-colors"
            >
              Upgrade to Starter
            </Link>
          </div>

          {/* Creator (Most popular) */}
          <div className="relative rounded-2xl border-2 border-orange-500 bg-neutral-900 p-8 flex flex-col shadow-[0_0_0_4px_rgba(234,88,12,0.15)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Most Popular
            </div>
            <div className="mb-6">
              <h3 className="text-2xl font-semibold">Creator</h3>
              <p className="text-sm text-gray-400">Perfect for creators and content makers</p>
            </div>
            <div className="mb-6">
              <p className="text-5xl font-bold">$29</p>
              <p className="text-gray-400">per month</p>
            </div>
            <ul className="space-y-3 text-sm text-gray-300 mb-8">
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> All Starter features</li>
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Advanced features</li>
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Custom prompts</li>
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Priority support</li>
            </ul>
            <Link
              href={CREATOR_URL || '#'}
              onClick={(e) => { e.preventDefault(); handlePurchase(CREATOR_PLAN_ID, CREATOR_URL || undefined); }}
              className="mt-auto text-center bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl py-3 transition-colors"
            >
              Upgrade to Creator
            </Link>
          </div>

          {/* Brand */}
          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-8 flex flex-col">
            <div className="mb-6">
              <h3 className="text-2xl font-semibold">Brand</h3>
              <p className="text-sm text-gray-400">Great for teams and small brands</p>
            </div>
            <div className="mb-6">
              <p className="text-5xl font-bold">$69</p>
              <p className="text-gray-400">per month</p>
            </div>
            <ul className="space-y-3 text-sm text-gray-300 mb-8">
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> All Creator features</li>
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Team collaboration</li>
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Higher limits</li>
            </ul>
            <Link
              href={BRAND_URL || '#'}
              onClick={(e) => { e.preventDefault(); handlePurchase(BRAND_PLAN_ID, BRAND_URL || undefined); }}
              className="mt-auto text-center bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl py-3 transition-colors"
            >
              Upgrade to Brand
            </Link>
          </div>

          {/* Professional */}
          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-8 flex flex-col">
            <div className="mb-6">
              <h3 className="text-2xl font-semibold">Professional</h3>
              <p className="text-sm text-gray-400">Ideal for growing businesses</p>
            </div>
            <div className="mb-6">
              <p className="text-5xl font-bold">$99</p>
              <p className="text-gray-400">per month</p>
            </div>
            <ul className="space-y-3 text-sm text-gray-300 mb-8">
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> All premium models</li>
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Dedicated support</li>
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Custom integrations</li>
              <li className="flex items-center gap-2"><span className="text-orange-500">•</span> API access</li>
            </ul>
            <Link
              href={PRO_URL || '#'}
              onClick={(e) => { e.preventDefault(); handlePurchase(PRO_PLAN_ID, PRO_URL || undefined); }}
              className="mt-auto text-center bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl py-3 transition-colors"
            >
              Upgrade to Professional
            </Link>
          </div>
        </div>
      </div>
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-md">
          {error}
        </div>
      )}
    </div>
  );
}
