/**
 * Every word a shopper reads on this host (TAP-T08). One file, so the words can
 * be reviewed, tested and later translated in one place.
 *
 * The 12 tap states and the phrases marked "copy deck" are the approved text
 * from PRD-TAP-001 §2.2 and §8 — change them there first. One word per thing:
 * tag (not chip or NFC), check (not verify or scan), record (not token or
 * twin), owner (not wallet or holder), brand (not issuer), authentic (the
 * verdict word).
 *
 * Client-safe: plain data, no imports.
 */

export type Tone = "ok" | "warn" | "bad" | "neutral";

/** The 12 situations a tap can end in (PRD-TAP-001 §2.2, "States and words"). */
export type TapStateKey =
  | "newForSale"
  | "newNotForSale"
  | "owned"
  | "notReleased"
  | "reported"
  | "retired"
  | "checkFailed"
  | "linkUsed"
  | "noProduct"
  | "ourSide"
  | "linkIncomplete"
  | "privateItem";

export interface StateCopy {
  tone: Tone;
  headline: string;
  line: string;
}

export const TAP_STATES: Record<TapStateKey, StateCopy> = {
  newForSale: {
    tone: "ok",
    headline: "Authentic",
    line: "Checked just now with the brand's record",
  },
  newNotForSale: {
    tone: "ok",
    headline: "Authentic",
    line: "Checked just now with the brand's record",
  },
  owned: {
    tone: "ok",
    headline: "Authentic",
    line: "This item has a registered owner",
  },
  notReleased: {
    tone: "warn",
    headline: "Not released for sale yet",
    line: "The tag is real, but the brand has not released this item",
  },
  reported: {
    tone: "bad",
    headline: "Reported lost or stolen",
    line: "Please don't buy this item",
  },
  retired: {
    tone: "neutral",
    headline: "Retired",
    line: "This item was recycled and its record is closed",
  },
  checkFailed: {
    tone: "bad",
    headline: "We couldn't verify this tag",
    line: "It didn't pass our check, so we can't confirm this product is authentic",
  },
  linkUsed: {
    tone: "warn",
    headline: "This check has expired",
    line: "Each tap makes a one-time link, and this one was already used",
  },
  noProduct: {
    tone: "warn",
    headline: "Tag not linked to a product",
    line: "This is a real TAG IT tag, but no product is registered to it yet",
  },
  ourSide: {
    tone: "warn",
    headline: "We couldn't finish the check",
    line: "Something went wrong on our side. Your product may be fine",
  },
  linkIncomplete: {
    tone: "warn",
    headline: "This link is incomplete",
    line: "Tap the tag again to get a fresh link",
  },
  privateItem: {
    tone: "ok",
    headline: "Authentic",
    line: "The owner keeps this item's details private",
  },
};

/**
 * The record page (/asset/…) is opened from a link, not from a tap, so it can
 * say what the brand's record says — never that the product in someone's hand
 * was checked. These lines replace the tap lines there.
 */
export type RecordStateKey =
  | "registered"
  | "notReleased"
  | "reported"
  | "retired"
  | "privateItem"
  | "noRecord"
  | "notLoaded"
  | "notANumber";

export const RECORD_STATES: Record<RecordStateKey, StateCopy> = {
  registered: {
    tone: "neutral",
    headline: "Registered product",
    line: "This is the brand's record for this item. To check the product in your hand, tap its tag",
  },
  notReleased: {
    tone: "warn",
    headline: "Not released for sale yet",
    line: "The brand has registered this item but has not released it",
  },
  reported: {
    tone: "bad",
    headline: TAP_STATES.reported.headline,
    line: TAP_STATES.reported.line,
  },
  retired: {
    tone: "neutral",
    headline: TAP_STATES.retired.headline,
    line: TAP_STATES.retired.line,
  },
  privateItem: {
    tone: "neutral",
    headline: "Private item",
    line: "The owner keeps this item's details private. To check the product in your hand, tap its tag",
  },
  noRecord: {
    tone: "neutral",
    headline: "No record with this number",
    line: "No product is registered under this number",
  },
  notLoaded: {
    tone: "warn",
    headline: "We couldn't load this record",
    line: "Something went wrong on our side. Please try again",
  },
  notANumber: {
    tone: "warn",
    headline: TAP_STATES.linkIncomplete.headline,
    line: "A record number is a whole number, like 58",
  },
};

export const COPY = {
  /** Shown in the header of every page. */
  pageLabel: "Product check",

  /** Copy deck: the frame shown while a tap is checked. */
  checking: {
    title: "Checking your product…",
    usual: "This usually takes a second or two.",
    slow: "Still checking. This can take a few seconds.",
    steps: ["Reading the tag", "Confirming it's authentic", "Finding the product record"],
    retry: "Try again",
    reassurance: "No app and no sign-in needed to check a product.",
    opening: "Opening the product page",
  },

  /** Copy deck: status chips. */
  chips: {
    isNew: "New",
    forSale: "For sale",
    owned: "Owned",
    notReleased: "Not released yet",
    reported: "Reported",
    retired: "Retired",
  },

  product: {
    fallbackName: "This product",
    madeIn: (place: string) => `Made in ${place}`,
    photoAlt: (name: string) => `Photo of ${name}`,
    /** Names for assistive technology: the product block and its status chips. */
    sectionLabel: "Product",
    statusLabel: "Status",
  },

  /** What each state adds under the product. */
  status: {
    newTitle: "New. No one has registered it yet.",
    howWeKnowLink: "How we know it's authentic",
    secondHandTitle: "Buying it second-hand?",
    /** Copy deck. */
    secondHandBody:
      "Ask the seller to transfer it to you in the TAG IT app. Only the real owner can do that.",
    notReleasedTip: "If someone is selling it, ask the brand before you buy.",
    noProductTip: "If you bought this product, ask the seller or the brand about it.",
    tagIsRealNote: "The tag is real. The warning is about this item.",
    detailsNotConfirmed:
      "We couldn't confirm these product details against the brand's record, so treat them with care.",
    /** The check finished, but the product's details did not load. */
    detailsUnavailable:
      "We couldn't load this product's details just now. The result above still stands.",
    /** Under a warning about an item whose owner keeps its details private: the same words. */
    detailsPrivate: `${TAP_STATES.privateItem.line}.`,
    noRecordNote:
      "A missing record is not a warning about a product. It only means this number was never registered.",
  },

  actions: {
    seeDetails: "See product details",
    tryAgain: "Try again",
    reportProblem: "Report a problem",
    reportSighting: "Report where you saw it",
    backHome: "Check another product",
  },

  reported: {
    meaningTitle: "What this means",
    meaning: [
      "This item was reported lost or stolen.",
      "The report is under review. This warning stays until it is closed.",
    ],
    doTitle: "What to do",
    steps: [
      "Don't buy it or accept it as payment.",
      "If someone offered it to you, tell us where you saw it. It helps the owner get it back.",
    ],
  },

  checkFailed: {
    doTitle: "What to do",
    steps: [
      {
        title: "Tap the tag again",
        body: "Hold the top of your phone on the tag for a second.",
      },
      {
        title: "Same result twice?",
        body: "Treat the product as unverified. A copied or damaged tag fails this check.",
      },
      {
        title: "Tell the seller or the brand",
        body: "An honest seller will want to know, and so will we.",
      },
    ],
    why: "Every authentic tag makes a new secret code on each tap. This one didn't pass.",
  },

  linkUsed: {
    againTitle: "Tap the tag again",
    againBody: "Hold the top of your phone on the tag to get a fresh check.",
    whyTitle: "Why links expire",
    why: [
      "A copied link, a screenshot or a forwarded message can't pass as a real check.",
      "Only a new tap on the real tag counts. It takes a second.",
    ],
  },

  linkIncomplete: {
    tip: "Hold the top of your phone on the tag for a second.",
  },

  ourSide: {
    tip: "If it keeps happening, wait a minute and tap the tag again.",
  },

  about: {
    title: "About this product",
    facts: {
      brand: "Brand",
      model: "Model",
      madeIn: "Made in",
      code: "Product code",
      registered: "Registered on",
    },
  },

  /** Copy deck: the three trust points. */
  trust: {
    title: "How we know it's authentic",
    points: [
      {
        title: "The tag proves itself",
        body: "Each tap makes a one-time code that only this tag can produce. A copy fails.",
      },
      {
        title: "The brand registered this exact item",
        body: "It was recorded when it was made.",
        bodyWithBrand: (brand: string) => `${brand} recorded it when it was made.`,
      },
      {
        title: "The record can't be quietly changed",
        body: "It is kept on a public ledger that anyone can inspect.",
      },
    ],
  },

  /**
   * The same three ideas for pages where nothing was confirmed (a failed or
   * expired check, the record page): how a check works in general, without
   * saying that this item passed one.
   */
  howItWorks: {
    title: "How the check works",
    points: [
      {
        title: "Every tag proves itself",
        body: "Each tap makes a one-time code that only the real tag can produce. A copy fails.",
      },
      {
        title: "Brands register each item",
        body: "The check compares the tag with the brand's record of that exact item.",
      },
      {
        title: "Records can't be quietly changed",
        body: "They are kept on a public ledger that anyone can inspect.",
      },
    ],
  },

  reviews: {
    title: "Owner reviews",
    none: "No reviews yet.",
    count: (n: number) => `${n} verified owner ${n === 1 ? "review" : "reviews"}`,
    starsLabel: (value: number) => `${value.toFixed(1)} out of 5 stars`,
    onlyOwners:
      "Only people who own this product can review it, so every review is from a real buyer.",
    verifiedOwner: "Verified owner",
    write: "Own it? Write a review",
    loading: "Opening the review form…",
    formTitle: (name: string) => `Review ${name}`,
    close: "Close",
    preparing: "Getting things ready…",
    signInBody:
      "Sign in with the email you used when you bought this item. Only its registered owner can review it.",
    signIn: "Sign in to review",
    starsGroup: "Your rating",
    starOption: (n: number) => `${n} ${n === 1 ? "star" : "stars"}`,
    placeholder: "Optional: a few words for other buyers (500 characters at most)",
    ownerNote: "We confirm you are the registered owner when you send your review.",
    sending: "Sending…",
    send: (n: number) => `Send ${n}-star review`,
    pickStars: "Choose a star rating",
    notOwner:
      "Only the registered owner of this item can review it. If you just bought it, finish registering it first.",
    failed: "We couldn't save your review. Please try again.",
    thanks: "Thank you. Your review is saved.",
  },

  history: {
    title: "Product history",
    loading: "Loading the product history…",
    unavailable: "We couldn't load the history right now. This says nothing about the item itself.",
    empty: "No history has been recorded for this item yet.",
    made: "Made and registered",
    madeBy: (brand: string) => `Made and registered by ${brand}`,
    tagAttached: "Tag attached",
    released: "Released for sale",
    bought: "Bought and registered to its owner",
    resold: "Sold to a new owner",
    reported: "Reported lost or stolen",
    reportClosed: "Report closed",
    retired: "Retired",
    updated: "Record updated",
  },

  help: {
    title: "Need help?",
    reportProblem: "Report a problem",
  },

  /** Copy deck: the closed drawer at the bottom. */
  technical: {
    title: "Technical details",
    recordNumber: "Record number",
    timesChecked: "Times this tag was checked",
    network: "Network",
    networkValue: "Base Sepolia (test network)",
    tagId: "Tag ID",
    recordState: "Record state",
    registered: "Registered",
    productDetails: "Product details",
    detailsMatch: "Match the brand's public record",
    detailsPending: "Not on the public record yet",
    detailsMismatch: "Do not match the brand's public record",
    detailsUpdating: "A newer version is still being recorded",
    productNumber: "Product number (GTIN)",
    serial: "Serial number",
    recordFingerprint: "Record fingerprint",
    viewPublicRecord: "View the public record",
    recordPage: "Open this product's record page",
    machinePassport: "Machine-readable product passport",
  },

  /** Copy deck: on every page. */
  honestStatus:
    "Pilot version. Records are kept on a public test network, and the system has not completed an external security audit.",
  footerBrand: "TAG IT Network",

  /** Copy deck: buying. The three-way payment sheet is TAP-T13. */
  buy: {
    button: (price: string) => `Buy now · ${price}`,
    buttonNoPrice: "Buy now",
    signInNote: "You'll sign in with your email first.",
    demoNote: "Demo checkout. No real money is charged.",
    preparing: "Getting things ready…",
    paying: "Confirming your payment…",
    registering: "Registering you as the owner…",
    successTitle: "It's yours.",
    successBody: (name: string) => `${name} is now registered to you.`,
    viewRecord: "View the public record",
    paymentFailed: "Payment didn't go through. You haven't been charged. Try again.",
    noFunds:
      "There are no test funds in your demo account yet, so the payment didn't go through. You haven't been charged.",
    /** A closed note under that message: how to put test funds in the demo account. */
    addFundsTitle: "How to add test funds",
    addFundsBody:
      "This checkout is a demo. Get free test funds for your demo account, then try again.",
    addFundsAccount: "Your demo account",
    addFundsLink: "Get free test funds",
    justSold: "Sorry, this item was just sold or taken off sale. You haven't been charged.",
    notReady: "Still getting things ready. Try again in a moment.",
    failed: "We couldn't finish the purchase. You haven't been charged. Try again.",
  },

  /** Read out while the record page loads. */
  recordLoading: "Loading the record…",

  home: {
    title: "Check a product",
    lead: "Hold your phone on the tag of a product and the result opens here.",
    lookupLabel: "Or look up a record by its number",
    placeholder: "For example 58",
    lookupButton: "Look up",
    notANumber: "Enter the record number as digits, like 58.",
  },
} as const;

/** Where "Report a problem" goes. Already the public contact on pro.tagit.network. */
export const SUPPORT_EMAIL = "info@tagit.network";

/** A mailto link with a subject line that tells support what it is about. */
export function supportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
