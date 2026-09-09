import type { RatingsView } from "@/lib/ratings-shared";

/** Server-rendered stars + counts + recent verified-owner reviews. */
export function Stars({ value, size = "text-base" }: { value: number | null; size?: string }) {
  const v = value ?? 0;
  return (
    <span className={`${size} tracking-tight`} aria-label={value === null ? "no ratings" : `${v.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(v) ? "text-[#00D68F]" : "text-gray-700"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function RatingSummary({ view, productName }: { view: RatingsView | null; productName: string }) {
  if (!view || view.restricted) return null;
  const line = view.product && view.product.count > 0 ? view.product : view.item;
  const scope = view.product && view.product.count > 0 ? "verified owners of this product" : "verified owner of this item";
  return (
    <div className="rounded-2xl border border-white/10 p-5 mb-5 animate-fadeUp" style={{ background: "rgba(255,255,255,0.03)", animationDelay: "0.3s" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Owner rating</div>
          {line.count === 0 ? (
            <p className="text-sm text-gray-400">No ratings yet — only verified owners can rate {productName}.</p>
          ) : (
            <p className="text-sm text-gray-300">
              <span className="text-2xl font-bold text-white mr-2">{line.average?.toFixed(1)}</span>
              <Stars value={line.average} /> <span className="text-gray-500">· {line.count} {line.count === 1 ? "rating" : "ratings"} from {scope}</span>
            </p>
          )}
        </div>
      </div>
      {view.reviews.length > 0 && (
        <ul className="mt-4 space-y-3">
          {view.reviews.slice(0, 3).map((r) => (
            <li key={r.id} className="border-t border-white/5 pt-3 text-sm">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Stars value={r.stars} size="text-sm" />
                <span className="font-mono">{r.rater}</span>
                <span>· verified owner</span>
                <span className="ml-auto">{r.createdAt.slice(0, 10)}</span>
              </div>
              {r.review && <p className="mt-1 text-gray-300 leading-relaxed">{r.review}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
