export default function Loading() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
      <div className="w-full max-w-sm animate-pulse">
        <div className="text-center mb-8">
          <div className="h-4 w-24 bg-white/10 rounded mx-auto mb-2" />
          <div className="h-3 w-20 bg-white/5 rounded mx-auto" />
        </div>
        <div className="h-8 w-48 bg-white/10 rounded mx-auto mb-2" />
        <div className="h-4 w-16 bg-white/5 rounded mx-auto mb-6" />
        <div className="flex justify-center mb-8">
          <div className="h-12 w-36 bg-white/10 rounded-full" />
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-16 bg-white/10 rounded" />
              <div className="h-4 w-24 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
