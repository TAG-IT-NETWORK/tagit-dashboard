import { ConsumerPage } from "@/components/consumer";
import { COPY } from "@/lib/consumer-copy";

/** Light skeleton in the shape of the record page: a banner, a photo, a name. */
export default function Loading() {
  return (
    <ConsumerPage>
      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="h-[72px] rounded-2xl bg-surface" />
        <div className="rounded-2xl bg-surface" style={{ aspectRatio: "4 / 3" }} />
        <div className="h-7 w-2/3 rounded bg-surface" />
        <div className="h-5 w-1/2 rounded bg-surface" />
      </div>
      <p className="sr-only">{COPY.recordLoading}</p>
    </ConsumerPage>
  );
}
