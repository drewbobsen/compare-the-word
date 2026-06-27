import ControlBar from './ControlBar';

// 1. Interfaces
interface VerseResponse {
  verse: number;
  text_1: string | null;
  text_2: string | null;
}

interface BookInfo {
  book: string;
  chapter_count: number;
}

interface TranslationInfo {
  code: string;
  name: string;
}

// 2. The OSIS Translation Map (Add the rest of the books as needed)
const BOOK_MAP: Record<string, string> = {
  // Old Testament
  "Gen": "Genesis",
  "Exod": "Exodus",
  "Lev": "Leviticus",
  "Num": "Numbers",
  "Deut": "Deuteronomy",
  "Josh": "Joshua",
  "Judg": "Judges",
  "Ruth": "Ruth",
  "1Sam": "1 Samuel",
  "2Sam": "2 Samuel",
  "1Kgs": "1 Kings",
  "2Kgs": "2 Kings",
  "1Chr": "1 Chronicles",
  "2Chr": "2 Chronicles",
  "Ezra": "Ezra",
  "Neh": "Nehemiah",
  "Esth": "Esther",
  "Job": "Job",
  "Ps": "Psalms",
  "Prov": "Proverbs",
  "Eccl": "Ecclesiastes",
  "Song": "Song of Solomon",
  "Isa": "Isaiah",
  "Jer": "Jeremiah",
  "Lam": "Lamentations",
  "Ezek": "Ezekiel",
  "Dan": "Daniel",
  "Hos": "Hosea",
  "Joel": "Joel",
  "Amos": "Amos",
  "Obad": "Obadiah",
  "Jonah": "Jonah",
  "Mic": "Micah",
  "Nah": "Nahum",
  "Hab": "Habakkuk",
  "Zeph": "Zephaniah",
  "Hag": "Haggai",
  "Zech": "Zechariah",
  "Mal": "Malachi",

  // New Testament
  "Matt": "Matthew",
  "Mark": "Mark",
  "Luke": "Luke",
  "John": "John",
  "Acts": "Acts",
  "Rom": "Romans",
  "1Cor": "1 Corinthians",
  "2Cor": "2 Corinthians",
  "Gal": "Galatians",
  "Eph": "Ephesians",
  "Phil": "Philippians",
  "Col": "Colossians",
  "1Thess": "1 Thessalonians",
  "2Thess": "2 Thessalonians",
  "1Tim": "1 Timothy",
  "2Tim": "2 Timothy",
  "Titus": "Titus",
  "Phlm": "Philemon",
  "Heb": "Hebrews",
  "Jas": "James",
  "1Pet": "1 Peter",
  "2Pet": "2 Peter",
  "1John": "1 John",
  "2John": "2 John",
  "3John": "3 John",
  "Jude": "Jude",
  "Rev": "Revelation",

  //Darn Catholics! JK, Love you guys!
  "Tob": "Tobit",
  "Jdt": "Judith",
  "Wis": "Wisdom of Solomon",
  "Sir": "Sirach (Ecclesiasticus)",
  "Bar": "Baruch",
  "EpJer": "Epistle of Jeremiah",
  "AddDan": "Additions to Daniel",
  "1Macc": "1 Maccabees",
  "2Macc": "2 Maccabees",
  "1Esd": "1 Esdras",
  "Lao": "Epistle to the Laodiceans",
  "PssSol": "Psalms of Solomon",
};

const CANONICAL_ORDER = Object.keys(BOOK_MAP);

export default async function ComparePage({
  searchParams,
}: {
  // Update the type definition to explicitly wrap it in a Promise
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>; 
}) {
  // 1. AWAIT the searchParams Promise before doing anything else!
  const params = await searchParams;

  // 2. Read the URL parameters from the resolved object
  const book = (params.book as string) || "Gen";
  const chapter = Number(params.chapter) || 1;
  const t1 = (params.t1 as string) || "";
  const t2 = (params.t2 as string) || "";

  // 3. Fetch directly across the Docker Network!
  const API_URL = process.env.INTERNAL_API_URL || "http://api:8080";

  // Fetch Metadata (Aggressively cached because books/translations never change)
  const [booksRes, transRes] = await Promise.all([
    fetch(`${API_URL}/api/books`, { cache: 'force-cache' }),
    fetch(`${API_URL}/api/translations`, { cache: 'force-cache' })
  ]);
  
  const rawBooks = await booksRes.json();
  const translations = await transRes.json();

  const sortedBooks = rawBooks.sort((a: any, b: any) => {
    return CANONICAL_ORDER.indexOf(a.book) - CANONICAL_ORDER.indexOf(b.book);
  });

  const currentT1 = t1 || (translations.length >= 2 ? translations[0].code : "");
  const currentT2 = t2 || (translations.length >= 2 ? translations[1].code : "");

  // 3. Fetch Verses
  let verses = [];
  if (currentT1 && currentT2) {
    const url = `${API_URL}/api/compare?book=${encodeURIComponent(book)}&chapter=${chapter}&t1=${currentT1}&t2=${currentT2}`;
    const versesRes = await fetch(url, { cache: 'no-store' }); // Don't cache dynamic searches
    if (versesRes.ok) {
      verses = await versesRes.json();
    }
  }

  const currentBookData = sortedBooks.find((b: any) => b.book === book);
  const chapterCount = currentBookData ? currentBookData.chapter_count : 1;

  // 4. Render the UI
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-300 font-sans selection:bg-zinc-700">
      
      {/* The Interactive Client Component */}
      <ControlBar 
        books={sortedBooks}
        translations={translations}
        currentBook={book}
        currentChapter={chapter}
        currentT1={currentT1}
        currentT2={currentT2}
        chapterCount={chapterCount}
        bookMap={BOOK_MAP}
      />

      {/* THE READING PANE (Rendered instantly on the Server) */}
      {/* THE READING PANE */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
        {/* 1. Add overflow-x-auto to create the horizontal swipe zone on mobile */}
        <div className="max-w-6xl mx-auto overflow-x-auto pb-4">
          {verses.length === 0 ? (
            <div className="text-zinc-500 mt-8">No verses found.</div>
          ) : (
            <div className="min-w-[600px] lg:min-w-0 grid grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-4">
              {verses.map((verseData: any) => (
                <div key={verseData.verse} className="contents group">
                  
                  {/* Left Column */}
                  <div className="flex gap-4 p-3 rounded-lg transition-colors group-hover:bg-zinc-900/80">
                    <span className="text-xs font-mono text-zinc-600 mt-1.5 shrink-0 select-none group-hover:text-zinc-400">
                      {verseData.verse}
                    </span>
                    <p className="text-lg leading-relaxed">{verseData.text_1 || <span className="italic text-zinc-600">Omitted</span>}</p>
                  </div>

                  {/* Right Column */}
                  <div className="flex gap-4 p-3 rounded-lg transition-colors group-hover:bg-zinc-900/80">
                    <span className="text-xs font-mono text-zinc-600 mt-1.5 shrink-0 select-none group-hover:text-zinc-400">
                      {verseData.verse}
                    </span>
                    <p className="text-lg leading-relaxed">{verseData.text_2 || <span className="italic text-zinc-600">Omitted</span>}</p>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </main>

    </div>
  );
}