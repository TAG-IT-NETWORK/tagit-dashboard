import { ConsumerPage } from "@/components/consumer";
import { COPY } from "@/lib/consumer-copy";

/**
 * With scripts turned off, nothing swaps the finished page in for this
 * skeleton: the browser receives the page, but it stays in the hidden block it
 * is sent in. So without scripts, hide the skeleton and show that block
 * instead (the same rule the checking frame has on the tap pages).
 */
const WITHOUT_SCRIPTS =
  '[data-record-loading]{display:none!important}div[hidden][id^="S:"]{display:block!important}';

/** Light skeleton in the shape of the record page: a seal, a headline, a photo, a name. */
export default function Loading() {
  return (
    <div data-record-loading="">
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: WITHOUT_SCRIPTS }} />
      </noscript>
      <ConsumerPage>
        <div className="flex flex-col items-center gap-4" aria-hidden="true">
          <div className="mt-3 h-[72px] w-[72px] rounded-full bg-surface" />
          <div className="h-8 w-3/5 rounded-lg bg-surface" />
          <div className="h-5 w-4/5 rounded bg-surface" />
          <div className="mt-2 w-full rounded-3xl bg-surface" style={{ aspectRatio: "4 / 3" }} />
          <div className="h-7 w-2/3 rounded-lg bg-surface" />
          <div className="h-5 w-1/2 rounded bg-surface" />
        </div>
        <p className="sr-only">{COPY.recordLoading}</p>
      </ConsumerPage>
    </div>
  );
}
