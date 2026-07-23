'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function VerseAnchor() {
  const searchParams = useSearchParams();
  const verse = searchParams.get('verse');

  useEffect(() => {
    if (!verse) return;

    const el = document.getElementById(`verse-${verse}`);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('verse-highlight');

    const timeout = setTimeout(() => {
      el.classList.remove('verse-highlight');
    }, 2000);

    return () => {
      clearTimeout(timeout);
      el.classList.remove('verse-highlight');
    };
  }, [verse]);

  return null;
}
