import type { Story, FuturePlan, SecretPlan } from "@/types/story";
import { buildStoryContext } from "@/lib/story-context";

/**
 * Decide of een geheim onthuld MAG worden vóór het schrijven van `chapterNumber`.
 * Regels: revealAtChapter <= chapterNumber, revealAfterPlanId is een revealed plan,
 * of revealAfterEvent komt voor in de tijdlijn tot en met chapterNumber - 1.
 */
export function shouldRevealSecret(
  secret: SecretPlan,
  story: Story,
  chapterNumber: number,
): boolean {
  if (secret.revealed) return true;
  if (secret.revealAtChapter != null && chapterNumber >= secret.revealAtChapter) return true;
  if (secret.revealAfterPlanId) {
    const plan = story.futurePlans?.find((p) => p.id === secret.revealAfterPlanId);
    if (plan && plan.status === "revealed") return true;
  }
  if (secret.revealAfterEvent) {
    const needle = secret.revealAfterEvent.toLowerCase();
    const hit = story.timeline.some(
      (e) =>
        e.title.toLowerCase().includes(needle) ||
        e.description.toLowerCase().includes(needle),
    );
    if (hit) return true;
  }
  return false;
}

/**
 * Splits geheimen op in (a) mag onthuld worden en (b) blijft verborgen.
 */
export function partitionSecrets(story: Story, chapterNumber: number) {
  const secrets = story.secrets ?? [];
  const unlockable = secrets.filter((s) => shouldRevealSecret(s, story, chapterNumber));
  const hidden = secrets.filter((s) => !shouldRevealSecret(s, story, chapterNumber));
  return { unlockable, hidden };
}

function futureLine(p: FuturePlan): string {
  const parts = [`[${p.kind}] ${p.title} (status: ${p.status})`];
  if (p.earliestChapter != null) parts.push(`vroegst: h${p.earliestChapter}`);
  if (p.targetChapter != null) parts.push(`doel: h${p.targetChapter}`);
  return parts.join(" | ") + `\n  ${p.description}` + (p.hints ? `\n  Hints: ${p.hints}` : "");
}

/**
 * Bouwt de volledige World Bible die de AI vóór generatie leest.
 * Bevat de gewone story context + toekomstplan-instructies + onthulde geheimen.
 * Verborgen geheimen worden NIET aan de AI meegegeven zodat spoilers onmogelijk zijn.
 */
export function buildWorldBible(story: Story, chapterNumber: number): string {
  const base = buildStoryContext(story);
  const sections: string[] = [base];

  const futures = story.futurePlans ?? [];
  const active = futures.filter((p) => p.status !== "cancelled" && p.status !== "revealed");
  const seedable = active.filter(
    (p) => p.earliestChapter == null || chapterNumber >= p.earliestChapter,
  );
  const climaxNow = active.filter((p) => p.targetChapter === chapterNumber);
  const later = active.filter(
    (p) => p.earliestChapter != null && chapterNumber < p.earliestChapter,
  );

  if (active.length) {
    sections.push(
      "TOEKOMSTPLAN (STORY BIBLE — auteurs-only, publiek weet dit NIET):\n" +
        "Instructies voor de schrijver:\n" +
        "  - Later-plannen mogen NIET voorkomen of onthuld worden.\n" +
        "  - Seedable plannen mogen met kleine, subtiele hints worden voorbereid.\n" +
        "  - Climax-nu plannen MOETEN in dit hoofdstuk hun bepalende moment krijgen.\n\n" +
        (climaxNow.length
          ? "CLIMAX IN DIT HOOFDSTUK:\n" + climaxNow.map(futureLine).join("\n") + "\n\n"
          : "") +
        (seedable.length
          ? "MAG SUBTIEL GEZAAID WORDEN:\n" + seedable.map(futureLine).join("\n") + "\n\n"
          : "") +
        (later.length
          ? "NOG NIET AANRAKEN (spoilers verboden):\n" +
            later.map((p) => `[${p.kind}] ${p.title} — pas vanaf h${p.earliestChapter}`).join("\n")
          : ""),
    );
  }

  const { unlockable, hidden } = partitionSecrets(story, chapterNumber);
  if (unlockable.length) {
    sections.push(
      "ONTHULBARE GEHEIMEN (mogen nu in het verhaal blootgelegd worden):\n" +
        unlockable
          .map(
            (s) =>
              `- ${s.title}${s.owner ? ` (${s.owner})` : ""}: ${s.truth}`,
          )
          .join("\n"),
    );
  }
  if (hidden.length) {
    // Geen inhoud, alleen aantal — zodat AI weet dat er verborgen lagen zijn.
    sections.push(
      `VERBORGEN GEHEIMEN: er zijn nog ${hidden.length} geheim(en) die NIET onthuld mogen worden. De inhoud is bewust weggelaten om lekken te voorkomen.`,
    );
  }

  return sections.join("\n\n");
}
