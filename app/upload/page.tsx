import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { StatusBar } from "@/components/StatusBar";
import { UploadListForm } from "@/components/UploadListForm";
import { coworkInstruction } from "@/lib/data/cowork-instruction";
import { publishingRepo } from "@/lib/server/config";
import { currentData } from "@/lib/server/data";
import { requireKiteSession } from "@/lib/server/guards";

export default async function UploadPage() {
  const { session } = await requireKiteSession();
  const now = new Date();
  const { list, prices } = currentData(now);
  const configured = Boolean(process.env.GITHUB_TOKEN && publishingRepo(process.env));
  const instruction = coworkInstruction();

  return (
    <>
      <Link href="/setup" className="crumb">
        ← Back
      </Link>
      <StatusBar list={list} prices={prices} sessionExpiresAt={session.expiresAt} />
      <h1>Update today&apos;s list</h1>
      <ol className="steps-howto">
        <li>
          Once: save the instruction below in your Cowork project&apos;s instructions, so every screen run ends with
          the list as JSON. (Or paste it into the chat after a run.)
          <div className="instruction">
            <pre>{instruction}</pre>
            <CopyButton text={instruction} label="Copy instruction" />
          </div>
        </li>
        <li>Each day: run the screen in Cowork, copy the JSON it ends with, paste it here and publish.</li>
        <li>It&apos;s checked first; nothing goes live unless it&apos;s valid. The app updates in about 3–5 minutes.</li>
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
