import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "../components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { useSyncProfileToUI } from "@/lib/profile";
import { WelcomeScreen } from "@/components/WelcomeScreen";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Pagina niet gevonden</h2>
        <p className="mt-2 text-sm text-muted-foreground">De pagina die je zoekt bestaat niet of is verplaatst.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Terug naar start</Link>
        </div>
      </div>
    </div>
  );
}

function humanizeError(error: Error): { title: string; description: string } {
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("time-out") || msg.includes("timeout")) {
    return { title: "De server reageert niet", description: "Het duurde te lang voor er antwoord kwam. Controleer je verbinding en probeer het opnieuw." };
  }
  if (msg.includes("unauthorized") || msg.includes("401")) {
    return { title: "Je bent uitgelogd", description: "Je sessie is verlopen. Log opnieuw in om verder te gaan." };
  }
  if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("fetch")) {
    return { title: "Geen verbinding met de server", description: "We konden de server niet bereiken. Controleer je internetverbinding." };
  }
  if (msg.includes("not found") || msg.includes("404")) {
    return { title: "Niet gevonden", description: "Wat je zoekt bestaat niet meer of is verplaatst." };
  }
  return { title: "Er ging iets mis", description: "Onverwachte fout tijdens het laden van deze pagina. Probeer opnieuw, of wis de lokale cache als het probleem blijft." };
}

async function clearLocalCacheAndReload() {
  try {
    localStorage.clear();
    sessionStorage.clear();
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (e) {
    console.warn("clearLocalCacheAndReload partial failure", e);
  } finally {
    window.location.replace("/");
  }
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  const { title, description } = humanizeError(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive text-2xl">!</div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Technische details</summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-words">{error?.message || String(error)}</pre>
        </details>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">Probeer opnieuw</button>
          <button onClick={() => window.location.reload()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Applicatie herladen</button>
          <button onClick={() => { void clearLocalCacheAndReload(); }} className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">Lokale cache wissen en herladen</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">Naar start</a>
        </div>
      </div>
    </div>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "StoryForge AI" },
      { name: "description", content: "An advanced AI storytelling platform for crafting endless worlds and books." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function ProfileSyncer() { useSyncProfileToUI(); return null; }

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <ProfileSyncer />
            <Outlet />
            <WelcomeScreen />
            <Toaster theme="dark" position="bottom-right" richColors />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
