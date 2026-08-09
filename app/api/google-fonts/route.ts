import { NextResponse } from "next/server";

type GoogleFontsMetadata = {
  familyMetadataList?: Array<{ family?: string }>;
};

export async function GET() {
  try {
    const response = await fetch("https://fonts.google.com/metadata/fonts", {
      next: { revalidate: 86_400 },
    });
    if (!response.ok) throw new Error("Google Fonts metadata request failed");
    const metadata = (await response.json()) as GoogleFontsMetadata;
    const fonts = (metadata.familyMetadataList ?? [])
      .map((item) => item.family)
      .filter((family): family is string => Boolean(family))
      .sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ fonts });
  } catch {
    return NextResponse.json({ fonts: [] }, { status: 502 });
  }
}
