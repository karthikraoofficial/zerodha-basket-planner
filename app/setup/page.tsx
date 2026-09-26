import { Stepper } from "@/components/Stepper";
import { StatusBar } from "@/components/StatusBar";
import { BUCKET_DEPTHS } from "@/lib/allocate/allocate";
import { HORIZON_LABELS, HORIZONS } from "@/lib/data/list";
import { formatBucket } from "@/lib/money";
import { currentData } from "@/lib/server/data";
import { requireKiteSession } from "@/lib/server/guards";
import { selectSetup } from "./actions";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { session } = await requireKiteSession();
  const { error } = await searchParams;
  const { list, prices } = currentData(new Date());
  const lists = list.status === "ok" || list.status === "stale" ? list.list.horizons : {};

  return (
    <>
      <Stepper current={2} />
      <StatusBar list={list} prices={prices} sessionExpiresAt={session.expiresAt} />
      <h1>Choose a bucket and horizon</h1>
      {error && <p className="alert">Pick one bucket and one of the available horizons.</p>}
      <form action={selectSetup} className="setup">
        <fieldset>
          <legend>Bucket</legend>
          <div className="choices">
            {[...BUCKET_DEPTHS].map(([paise, depth]) => (
              <label key={paise} className="choice">
                <input type="radio" name="bucket" value={paise} required defaultChecked={session.bucketPaise === paise} />
                <span className="choice-main">{formatBucket(paise)}</span>
                <span className="choice-sub">up to {depth} names</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Profit horizon</legend>
          <div className="choices">
            {HORIZONS.map((h) => {
              const names = lists[h]?.length;
              return (
                <label key={h} className={names ? "choice" : "choice choice-off"}>
                  <input
                    type="radio"
                    name="horizon"
                    value={h}
                    required
                    disabled={!names}
                    defaultChecked={Boolean(names) && session.horizon === h}
                  />
                  <span className="choice-main">{HORIZON_LABELS[h]}</span>
                  <span className="choice-sub">{names ? `${names} names ranked` : "not in today's list"}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <button className="button" type="submit">
          See the plan
        </button>
      </form>
      <form action="/api/kite/logout" method="post" className="logout">
        <button type="submit" className="link">
          Log out of Kite
        </button>
      </form>
    </>
  );
}
