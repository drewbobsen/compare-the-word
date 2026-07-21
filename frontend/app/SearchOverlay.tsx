'use client';

import { useState } from 'react';

export interface SearchResult {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  highlight: string | null;
}

export default function SearchOverlay({ translation }: { translation: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&t=${encodeURIComponent(translation)}`);
      
      if (!res.ok) throw new Error('Failed to fetch results');
      
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error(err);
      setError('An error occurred while searching.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-40 bg-zinc-800 text-zinc-300 p-4 rounded-full shadow-lg hover:bg-zinc-700 hover:text-white transition-colors border border-zinc-700"
        aria-label="Search"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-zinc-950/90 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            
            {/* Header & Search Input */}
            <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search in ${translation.toUpperCase()}...`}
                  className="flex-1 bg-zinc-950 text-zinc-200 px-4 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                />
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? '...' : 'Search'}
                </button>
              </form>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-2"
              >
                ✕
              </button>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
              {error && <p className="text-red-400 text-sm">{error}</p>}
              
              {!loading && results.length === 0 && query && !error && (
                <p className="text-zinc-500 text-center py-8">No results found for "{query}".</p>
              )}

              {results.map((result, index) => (
                <div key={index} className="p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                  <h3 className="text-sm font-mono text-zinc-500 mb-1">
                    {result.book} {result.chapter}:{result.verse}
                  </h3>
                  <p 
                    className="text-zinc-300 leading-relaxed search-highlight"
                    dangerouslySetInnerHTML={{ 
                      __html: result.highlight || result.text 
                    }} 
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}