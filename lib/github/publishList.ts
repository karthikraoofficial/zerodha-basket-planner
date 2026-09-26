// Validate a pasted ranked list and publish it as data/latest.json. Nothing is committed unless
// the list passes the same checks the build and the plan page apply.
import { parseListText, type Horizon } from "../data/list";

type Publish = (file: { content: string; message: string }) => Promise<{ commitSha: string; commitUrl: string }>;

export type PublishListResult =
  | { ok: true; screenDate: string; horizons: Horizon[]; warnings: string[]; commitUrl: string }
  | { ok: false; problems: string[] };

export async function publishList({ text, now, publish }: { text: string; now: Date; publish: Publish }): Promise<PublishListResult> {
  const parsed = parseListText(text, now);
  switch (parsed.status) {
    case "missing":
      return { ok: false, problems: ["No list was provided"] };
    case "invalid":
      return { ok: false, problems: parsed.issues };
    case "non-nse":
      return { ok: false, problems: [`non-NSE symbols: ${parsed.symbols.join(", ")} (only NSE is supported)`] };
    case "stale":
      return { ok: false, problems: [`list is stale: ${parsed.tradingDaysOld} trading days old (2 at most)`] };
  }

  const { screenDate } = parsed.list;
  try {
    const { commitUrl } = await publish({
      content: JSON.stringify(JSON.parse(text), null, 2) + "\n",
      message: `Update ranked list for ${screenDate}`,
    });
    return { ok: true, screenDate, horizons: parsed.availableHorizons, warnings: parsed.warnings, commitUrl };
  } catch (e) {
    return { ok: false, problems: [`GitHub refused the commit: ${(e as Error).message}`] };
  }
}
