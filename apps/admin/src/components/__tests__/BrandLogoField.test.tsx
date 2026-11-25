import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BrandLogoField } from "../brand-logo-field";

/**
 * TAP-T17: the logo field on a brand's card. Upload goes through the media
 * door, fills the address in and leaves saving to the Save button.
 */

const SM = "https://media.tagit.network/i/abc/sm.webp";
const GOOD = {
  ok: true,
  media: [{ sha256: "abc", urls: { sm: SM, t: "https://media.tagit.network/i/abc/t.webp" } }],
};

function Harness({ start = "", disabled = false }: { start?: string; disabled?: boolean }) {
  const [value, setValue] = useState(start);
  return (
    <>
      <BrandLogoField
        id="logo"
        brandName="Aurora"
        value={value}
        disabled={disabled}
        onChange={setValue}
      />
      <span data-testid="value">{value}</span>
    </>
  );
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const png = (size = 10, type = "image/png", name = "logo.png") => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};
const choose = (file: File) =>
  fireEvent.change(screen.getByLabelText("Choose a logo image for Aurora"), {
    target: { files: [file] },
  });
const value = () => screen.getByTestId("value").textContent;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BrandLogoField: upload", () => {
  it("sends the file to the media door and fills in the small copy's address", async () => {
    const fetchMock = vi.fn(async () => json(GOOD, 201));
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness />);
    choose(png());

    await waitFor(() => expect(value()).toBe(SM));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/media-proxy");
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body.getAll("files")).toHaveLength(1);
    expect((body.get("files") as File).name).toBe("logo.png");
    // No address is ever sent for the server to fetch.
    expect([...body.keys()]).toEqual(["files"]);
    expect(screen.getByRole("status").textContent).toMatch(/Press Save to keep it/);
    expect(screen.getByRole("img", { name: "Aurora logo" }).getAttribute("src")).toBe(SM);
  });

  it("does not send a file of the wrong kind or size, and says why", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness start="https://old.example/logo.png" />);

    choose(png(10, "image/svg+xml", "logo.svg"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/PNG, JPG or WebP/);
    choose(png(5 * 1024 * 1024));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/over 4\.5 MB/));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(value()).toBe("https://old.example/logo.png");
  });

  it("keeps the old address and explains when the upload is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ ok: false, error: "viewer role is read-only" }, 403)),
    );
    render(<Harness start="https://old.example/logo.png" />);
    choose(png());
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(value()).toBe("https://old.example/logo.png");
  });

  it("keeps the old address when the answer carries no usable address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ ok: true, media: [{ urls: { sm: "javascript:alert(1)" } }] }, 201)),
    );
    render(<Harness start="https://old.example/logo.png" />);
    choose(png());
    expect((await screen.findByRole("alert")).textContent).toMatch(/no address came back/);
    expect(value()).toBe("https://old.example/logo.png");
  });

  it("frees the button and says so when the request never leaves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    render(<Harness />);
    choose(png());
    expect((await screen.findByRole("alert")).textContent).toMatch(/did not go through/);
    expect(
      (screen.getByRole("button", { name: /Upload logo/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(value()).toBe("");
  });

  it("locks the buttons while an upload is running", async () => {
    let finish: (r: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (finish = resolve))),
    );
    render(<Harness start={SM} />);
    choose(png());
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: /Uploading/ }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
    expect((screen.getByRole("button", { name: /Remove/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText("Logo") as HTMLInputElement).disabled).toBe(true);
    finish(json(GOOD, 201));
    await waitFor(() => expect(screen.getByRole("button", { name: /Upload logo/ })).toBeTruthy());
  });
});

describe("BrandLogoField: the address and the preview", () => {
  it("shows the brand's initial when there is no logo, and no Remove button", () => {
    render(<Harness />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector("[data-logo-preview]")?.textContent).toBe("A");
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("never loads an address that is not https, and says it will not show", () => {
    for (const bad of [
      "http://x.example/a.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
    ]) {
      render(<Harness start={bad} />);
      expect(screen.queryByRole("img")).toBeNull();
      expect(screen.getByText(/must start with https/)).toBeTruthy();
      cleanup();
    }
  });

  it("falls back to the initial and says so when the image cannot be loaded", () => {
    render(<Harness start="https://gone.example/logo.png" />);
    fireEvent.error(screen.getByRole("img", { name: "Aurora logo" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(/No image could be loaded/)).toBeTruthy();
    // A new address gets a fresh try.
    fireEvent.change(screen.getByLabelText("Logo"), { target: { value: SM } });
    expect(screen.getByRole("img", { name: "Aurora logo" }).getAttribute("src")).toBe(SM);
  });

  it("tries the same address again after it was removed and typed back", () => {
    const gone = "https://gone.example/logo.png";
    render(<Harness start={gone} />);
    fireEvent.error(screen.getByRole("img", { name: "Aurora logo" }));
    expect(screen.queryByRole("img")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    fireEvent.change(screen.getByLabelText("Logo"), { target: { value: gone } });
    expect(screen.getByRole("img", { name: "Aurora logo" }).getAttribute("src")).toBe(gone);
    expect(screen.queryByText(/No image could be loaded/)).toBeNull();
  });

  it("tells the card when an upload starts and when it ends, whatever the outcome", async () => {
    const seen: boolean[] = [];
    for (const answer of [
      () => Promise.resolve(json(GOOD, 201)),
      () => Promise.resolve(json({ ok: false, error: "X" }, 500)),
      () => Promise.reject(new TypeError("Failed to fetch")),
    ]) {
      seen.length = 0;
      vi.stubGlobal("fetch", vi.fn(answer));
      render(
        <BrandLogoField
          id="logo"
          brandName="Aurora"
          value=""
          onChange={() => undefined}
          onUploadingChange={(v) => seen.push(v)}
        />,
      );
      choose(png());
      await waitFor(() => expect(seen).toEqual([true, false]));
      cleanup();
    }
    // A file that is refused before sending never reports an upload.
    seen.length = 0;
    render(
      <BrandLogoField
        id="logo"
        brandName="Aurora"
        value=""
        onChange={() => undefined}
        onUploadingChange={(v) => seen.push(v)}
      />,
    );
    choose(png(10, "image/gif"));
    await screen.findByRole("alert");
    expect(seen).toEqual([]);
  });

  it("Remove clears the address and leaves saving to Save", () => {
    render(<Harness start={SM} />);
    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    expect(value()).toBe("");
    expect(screen.getByRole("status").textContent).toMatch(/Press Save/);
  });

  it("a pasted address still works", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Logo"), { target: { value: SM } });
    expect(value()).toBe(SM);
  });

  it("is locked when the card is busy", () => {
    render(<Harness start={SM} disabled />);
    expect(
      (screen.getByRole("button", { name: /Upload logo/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole("button", { name: /Remove/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText("Logo") as HTMLInputElement).disabled).toBe(true);
  });
});
