import { DesktopVerify } from "@/components/verify/desktop-verify";

export const dynamic = "force-dynamic";

/**
 * /verify — verify a tagged product on the desktop reader. The phone flow
 * (tap → SUN → verify.tagit.network) reproduced with the ACR1252U bridge:
 * read + decode the chip, resolve its token on-chain, show the full record.
 */
export default function VerifyPage() {
  return <DesktopVerify />;
}
