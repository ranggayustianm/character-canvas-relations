import { errorResponse, fetchWithRetry } from "@/lib/api";
import type { ApiCharacter, ApiShow } from "@/lib/types";

const BASE = "https://api.tvmaze.com";

type TvMazeShow = {
  id: number;
  name: string;
  image?: { medium?: string; original?: string } | null;
  premiered?: string | null;
};

type TvMazeCastEntry = {
  character: {
    id: number;
    name: string;
    image?: { medium?: string; original?: string } | null;
  };
  person?: { name: string } | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const cast = searchParams.get("cast")?.trim();

  try {
    if (q) {
      const res = await fetchWithRetry(
        `${BASE}/search/shows?q=${encodeURIComponent(q)}`
      );
      const json = (await res.json()) as { show: TvMazeShow }[];
      const shows: ApiShow[] = json.slice(0, 10).map(({ show }) => ({
        source: "tvmaze",
        externalId: String(show.id),
        name: show.name,
        imageUrl: show.image?.medium ?? show.image?.original,
        premiered: show.premiered ?? undefined,
      }));
      return Response.json({ shows });
    }

    if (cast) {
      const res = await fetchWithRetry(`${BASE}/shows/${encodeURIComponent(cast)}/cast`);
      const json = (await res.json()) as TvMazeCastEntry[];
      // Some bit parts have no name or image — keep it useful but dedupe by character.
      const seen = new Set<number>();
      const characters: ApiCharacter[] = [];
      for (const entry of json) {
        const c = entry.character;
        if (!c?.name || seen.has(c.id)) continue;
        seen.add(c.id);
        characters.push({
          source: "tvmaze",
          externalId: String(c.id),
          name: c.name,
          imageUrl: c.image?.medium ?? c.image?.original,
          subtitle: entry.person?.name ? `played by ${entry.person.name}` : undefined,
        });
      }
      return Response.json({ characters });
    }

    return Response.json({ error: "Missing ?q or ?cast parameter" }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
