import type { Story } from "@/types/story";

function download(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTxt(story: Story) {
  const body =
    `${story.title}\n${story.subtitle ?? ""}\n\n${story.description ?? ""}\n\n` +
    story.chapters
      .map((c) => `\n\nHoofdstuk ${c.number}: ${c.title}\n\n${c.content}`)
      .join("\n");
  download(`${story.title}.txt`, body);
}

export function exportJson(story: Story) {
  download(`${story.title}.json`, JSON.stringify(story, null, 2), "application/json");
}

export function exportHtml(story: Story) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${story.title}</title>
<style>body{font-family:Georgia,serif;max-width:780px;margin:2rem auto;padding:1rem;line-height:1.7;color:#222}h1{font-family:'Cinzel',serif}h2{margin-top:3rem;border-bottom:1px solid #ccc;padding-bottom:.4rem}</style>
</head><body><h1>${story.title}</h1><p><em>${story.subtitle ?? ""}</em></p><p>${story.description ?? ""}</p>${story.chapters
    .map(
      (c) =>
        `<h2>Hoofdstuk ${c.number}: ${c.title}</h2>${c.content
          .split(/\n+/)
          .map((p) => `<p>${p.replace(/</g, "&lt;")}</p>`)
          .join("")}`,
    )
    .join("")}</body></html>`;
  download(`${story.title}.html`, html, "text/html");
  // Easy "print to PDF" — instruct user
}

export async function importJsonFile(): Promise<Story | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const text = await file.text();
      try {
        resolve(JSON.parse(text) as Story);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}
