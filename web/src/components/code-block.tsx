"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

export function CodeBlock({ code, lang = "lua" }: { code: string; lang?: string }) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    codeToHtml(code, {
      lang,
      theme: "github-dark",
    }).then(setHtml);
  }, [code, lang]);

  if (!html) {
    return (
      <pre className="bg-[#0d1117] text-gray-300 rounded-md p-4 overflow-x-auto text-sm font-mono">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="rounded-md overflow-x-auto text-sm [&_pre]:p-4 [&_pre]:overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
