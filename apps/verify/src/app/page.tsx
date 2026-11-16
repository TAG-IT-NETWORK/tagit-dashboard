"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConsumerPage, Icon, NEEDS_SCRIPT, PRIMARY_BUTTON } from "@/components/consumer";
import { COPY } from "@/lib/consumer-copy";

/**
 * The front door. Most people never see it: a tap opens the result directly.
 * It says what to do (tap the tag) and lets someone look a record up by its
 * number.
 */
export default function VerifyHome() {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const router = useRouter();

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const id = value.trim();
    if (!id) return;
    // A record number is digits. Anything else has nowhere useful to go, so
    // say what is expected instead of opening a page that cannot help.
    if (/^\d{1,78}$/.test(id)) {
      router.push(`/asset/${id}`);
    } else {
      setInvalid(true);
    }
  }

  return (
    <ConsumerPage>
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-5 py-8 text-center">
        <Icon name="tag" size={48} strokeWidth={1.6} />
        <h1 className="text-2xl font-bold leading-[30px]">{COPY.home.title}</h1>
        <p className="text-[15px] leading-[22px] text-body">{COPY.home.lead}</p>
        <p className="text-[13px] leading-[18px] text-muted">{COPY.checking.reassurance}</p>
      </div>

      <form
        onSubmit={handleLookup}
        className="flex flex-col gap-3 pt-4"
        noValidate
        {...NEEDS_SCRIPT}
      >
        <label htmlFor="record-number" className="text-[15px] font-semibold leading-[22px]">
          {COPY.home.lookupLabel}
        </label>
        <input
          id="record-number"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          placeholder={COPY.home.placeholder}
          aria-invalid={invalid}
          aria-describedby={invalid ? "record-number-error" : undefined}
          className="min-h-[52px] w-full rounded-[14px] border border-line-field bg-white px-4 text-[17px] leading-6 text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        {invalid && (
          <p id="record-number-error" role="alert" className="text-sm leading-5 text-bad">
            {COPY.home.notANumber}
          </p>
        )}
        <button type="submit" className={PRIMARY_BUTTON}>
          {COPY.home.lookupButton}
        </button>
      </form>
    </ConsumerPage>
  );
}
