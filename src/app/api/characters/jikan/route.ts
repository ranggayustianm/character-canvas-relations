import { errorResponse, fetchWithRetry } from "@/lib/api";
import type { ApiCharacter } from "@/lib/types";

const BASE = "https://api.jikan.moe/v4"; //better use Tenrai now! Jikan will be terminated. https://api.tenrai.org/v1
const LIMIT = 12;

type JikanCharacter = {
  id: number;
  name: string;
  images?: { jpg?: { image_url?: string }; webp?: { image_url?: string } };
  about?: string | null;
};

function normalize(c: JikanCharacter, subtitle?: string): ApiCharacter {
  return {
    source: "jikan",
    externalId: String(c.id),
    name: c.name,
    imageUrl: c.images?.jpg?.image_url ?? c.images?.webp?.image_url,
    about: c.about?.slice(0, 300) || undefined,
    subtitle,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const anime = searchParams.get("anime")?.trim();

  try {
    if (q) {
      const res = await fetchWithRetry(
        `${BASE}/characters?q=${encodeURIComponent(q)}&limit=${LIMIT}&order_by=favorites&sort=desc&sfw=true`
      );
      const json = (await res.json()) as { data: JikanCharacter[] };
      return Response.json({ characters: json.data.map((c) => normalize(c)) });
    }

    if (anime) {
      // Resolve the title to its top anime hit, then list that anime's characters.
      const searchRes = await fetchWithRetry(
        `${BASE}/anime?q=${encodeURIComponent(anime)}&limit=1&sfw=true`
      );
      const searchJson = (await searchRes.json()) as {
        data: { id: number; title: string }[];
      };
      const show = searchJson.data[0];
      if (!show) return Response.json({ characters: [] });

      const castRes = await fetchWithRetry(`${BASE}/anime/${show.id}/characters`);
      const castJson = (await castRes.json()) as {
        data: { character: JikanCharacter; role: string }[];
      };
      const sorted = [...castJson.data].sort((a, b) =>
        a.role === "Main" ? -1 : b.role === "Main" ? 1 : 0
      );
      return Response.json({
        characters: sorted.slice(0, 30).map((entry) => normalize(entry.character, show.title)),
        sourceTitle: show.title,
      });
    }

    return Response.json({ error: "Missing ?q or ?anime parameter" }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
