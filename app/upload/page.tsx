import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { StatusBar } from "@/components/StatusBar";
import { UploadListForm } from "@/components/UploadListForm";
import { istDate } from "@/lib/data/calendar";
import { coworkInstruction } from "@/lib/data/cowork-instruction";
import { publishingRepo } from "@/lib/server/config";
import { currentData } from "@/lib/server/data";
import { requireKiteSession } from "@/lib/server/guards";

export default async function UploadPage() {
  const { session } = await requireKiteSession();
  const now = new Date();
  const { list, prices } = currentData(now);
  const configured = Boolean(process.env.GITHUB_TOKEN && publishingRepo(process.env));
  const instruction = coworkInstruction(istDate(now));

  return (
    <>
      <p className="sub">
        <Link href="/setup">← Back</Link>
      </p>
      <StatusBar list={list} prices={prices} sessionExpiresAt={session.expiresAt} />
      <h1>Update today&apos;s list</h1>
      <ol className="steps-howto">
        <li>Run your screen in Claude Cowork.</li>
        <li>
          Paste the instruction below into that chat. It replies with the list as JSON.
          <div className="instruction">
            <pre>{instruction}</pre>
            <CopyButton text={instruction} label="Copy instruction" />
          </div>
        </li>
        <li>Paste the reply here and publish. It&apos;s checked first; nothing goes live unless it&apos;s valid.</li>
      </ol>

      {!configured && (
        <div className="alert">
          <p>
            Publishing isn&apos;t set up yet. Create a fine-grained GitHub token for this repository only, with
            <strong> Contents: Read and write</strong>, then add it in Vercel as <code>GITHUB_TOKEN</code> (Production)
            and redeploy.
          </p>
        </div>
      )}
      <UploadListForm />
    </>
  );
}
