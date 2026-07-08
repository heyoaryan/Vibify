import { Library } from 'lucide-react';

export function LibraryView() {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center px-4 pb-12 pt-24 text-center lg:px-8">
      <div className="grid h-20 w-20 place-items-center rounded-2xl border border-white/5 bg-white/[0.03] text-ink-400 backdrop-blur-xl">
        <Library size={36} />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold text-ink-50">Your Library</h1>
      <p className="mt-2 max-w-xs text-sm text-ink-300">
        Your saved songs and playlists will appear here.
      </p>
    </div>
  );
}
