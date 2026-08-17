import { describe, it, expect } from "vitest";
import { isAllowedImageUrl, mediaImageLoader, mediaVariantUrl, variantForWidth } from "../media";

const SHA = "a".repeat(64);
const CDN = `https://media.tagit.network/i/${SHA}`;

describe("variantForWidth", () => {
  it("maps requested widths onto the nearest pre-baked variant", () => {
    expect(variantForWidth(1)).toBe("sm");
    expect(variantForWidth(384)).toBe("sm");
    expect(variantForWidth(385)).toBe("md");
    expect(variantForWidth(828)).toBe("md");
    expect(variantForWidth(829)).toBe("lg");
    expect(variantForWidth(3840)).toBe("lg");
  });
});

describe("mediaVariantUrl / mediaImageLoader", () => {
  it("rewrites a media-CDN variant URL to the width-matched variant", () => {
    expect(mediaVariantUrl(`${CDN}/lg.webp`, 300)).toBe(`${CDN}/sm.webp`);
    expect(mediaVariantUrl(`${CDN}/sm.webp`, 800)).toBe(`${CDN}/md.webp`);
    expect(mediaVariantUrl(`${CDN}/md.webp`, 1600)).toBe(`${CDN}/lg.webp`);
  });

  it("is what the next/image loader delegates to", () => {
    expect(mediaImageLoader({ src: `${CDN}/lg.webp`, width: 384 })).toBe(`${CDN}/sm.webp`);
  });

  it("passes through non-CDN URLs unchanged (never re-optimized either)", () => {
    const ipfs = "https://w3s.link/ipfs/QmZLqbsFDKpHc4BsnP4fVcNd4PEi6JriR9MUmJ9bia6oKQ/x.png";
    expect(mediaVariantUrl(ipfs, 300)).toBe(ipfs);
  });

  it("passes through CDN URLs that are not the /i/<sha>/<variant>.webp shape", () => {
    const staticAsset = "https://media.tagit.network/static/tagit-logo-1024.webp";
    expect(mediaVariantUrl(staticAsset, 300)).toBe(staticAsset);
  });

  it("does not throw on garbage src", () => {
    expect(mediaVariantUrl("not a url", 300)).toBe("not a url");
  });
});

describe("isAllowedImageUrl (image-domain allowlist incl. media.tagit.network)", () => {
  it("allows the media CDN and legacy IPFS gateways over https", () => {
    expect(isAllowedImageUrl(`${CDN}/lg.webp`)).toBe(true);
    expect(isAllowedImageUrl("https://w3s.link/ipfs/Qm/x.png")).toBe(true);
  });

  it("rejects other hosts, http, and garbage", () => {
    expect(isAllowedImageUrl("https://evil.example.com/x.png")).toBe(false);
    expect(isAllowedImageUrl(`http://media.tagit.network/i/${SHA}/lg.webp`)).toBe(false);
    expect(isAllowedImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedImageUrl(undefined)).toBe(false);
    expect(isAllowedImageUrl("")).toBe(false);
  });
});
