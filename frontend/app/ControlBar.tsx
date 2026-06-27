'use client';

import { useRouter } from 'next/navigation';

export default function ControlBar({ 
  books, 
  translations, 
  currentBook, 
  currentChapter, 
  currentT1, 
  currentT2, 
  chapterCount, 
  bookMap 
}: any) {
  const router = useRouter();
  const chapters = Array.from({ length: chapterCount }, (_, i) => i + 1);

  // This function updates the URL parameters when a dropdown changes
  const updateParams = (updates: any) => {
    const params = new URLSearchParams();
    params.set('book', updates.book ?? currentBook);
    params.set('chapter', (updates.chapter ?? currentChapter).toString());
    params.set('t1', updates.t1 ?? currentT1);
    params.set('t2', updates.t2 ?? currentT2);
    router.push(`/?${params.toString()}`); // Triggers a server-side re-render!
  };

  return (
<header className="bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800 p-4 lg:px-8 lg:h-20 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0 z-20">
      <h1 className="font-bold text-lg tracking-tight text-zinc-100 text-center lg:text-left">
        COMPARETHEWORD
      </h1>
      
      {/* 2x2 Grid on Mobile, Horizontal Row on Desktop */}
      <div className="grid grid-cols-2 lg:flex gap-2 lg:gap-4">
        {/* Translation 1 */}
        <select 
          value={currentT1} 
          onChange={(e) => updateParams({ t1: e.target.value })}
          className="order-3 lg:order-1 border border-zinc-800 rounded-md p-2 bg-zinc-900 text-zinc-200 font-medium text-sm lg:text-base outline-none focus:border-zinc-600"
        >
          {translations.map((t: any) => (
            <option key={`t1-${t.code}`} value={t.code}>{t.name}</option>
          ))}
        </select>

        {/* Book */}
        <select 
          value={currentBook} 
          onChange={(e) => updateParams({ book: e.target.value, chapter: 1 })}
          className="order-1 lg:order-2 border border-zinc-800 rounded-md p-2 bg-zinc-900 text-zinc-200 font-medium text-sm lg:text-base outline-none focus:border-zinc-600"
        >
          {books.map((b: any) => (
            <option key={b.book} value={b.book}>{bookMap[b.book] || b.book}</option>
          ))}
        </select>

        {/* Chapter */}
        <select 
          value={currentChapter} 
          onChange={(e) => updateParams({ chapter: Number(e.target.value) })}
          className="order-2 lg:order-3 border border-zinc-800 rounded-md p-2 bg-zinc-900 text-zinc-200 font-medium text-sm lg:text-base outline-none focus:border-zinc-600"
        >
          {chapters.map((num) => (
            <option key={num} value={num}>Ch. {num}</option>
          ))}
        </select>

        {/* Translation 2 */}
        <select 
          value={currentT2} 
          onChange={(e) => updateParams({ t2: e.target.value })}
          className="order-4 lg:order-4 border border-zinc-800 rounded-md p-2 bg-zinc-900 text-zinc-200 font-medium text-sm lg:text-base outline-none focus:border-zinc-600"
        >
          {translations.map((t: any) => (
            <option key={`t2-${t.code}`} value={t.code}>{t.name}</option>
          ))}
        </select>
      </div>
    </header>
  );
}