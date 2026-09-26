"use client";

import { useActionState, useRef, useState } from "react";
import { publishListAction } from "@/app/upload/actions";

export function UploadListForm() {
  const [result, action, pending] = useActionState(publishListAction, null);
  const [text, setText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
  }

  return (
    <form action={action} className="upload">
      <label htmlFor="list" className="field-label">
        Today&apos;s list (JSON from Cowork)
      </label>
      <textarea
        id="list"
        name="list"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{ "schema_version": 2, "screen_date": …, "horizons": { … } }'
        rows={10}
        spellCheck={false}
        required
      />
      <div className="action-buttons">
        <button type="button" className="button button-quiet" onClick={() => fileInput.current?.click()}>
          Choose file…
        </button>
        <input ref={fileInput} type="file" accept=".json,application/json,text/plain" hidden onChange={pickFile} />
        <button type="submit" className="button" disabled={pending || !text.trim()}>
          {pending ? "Checking and publishing…" : "Check & publish"}
        </button>
      </div>

      {result?.ok === false && (
        <div className="alert" role="alert">
          <p>Not published. Fix these and try again:</p>
          <ul>
            {result.problems.slice(0, 20).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {result?.ok && (
        <div className="success" role="status">
          <p>
            <strong>Published the {result.screenDate} list</strong> ({result.horizons.join(", ")}).{" "}
            <a href={result.commitUrl} target="_blank" rel="noreferrer">
              View commit
            </a>
          </p>
          <p className="sub">
            NSE prices for any new symbols are fetched next (~2 min), then the app redeploys. The new list is live in
            about 3–5 minutes. The status bar will show the new list date.
          </p>
          {result.warnings.length > 0 && (
            <ul className="sub">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
