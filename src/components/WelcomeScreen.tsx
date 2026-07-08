import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, LANGUAGES, useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

const SEEN_KEY = "sf_welcome_seen";

export function WelcomeScreen() {
  const { lang, setLang } = useI18n();
  const t = useT();
  const { user, loading } = useAuth();
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user) { setShow(false); return; }
    setShow(typeof window !== "undefined" && !localStorage.getItem(SEEN_KEY));
  }, [user, loading]);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, "1");
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-card border border-gold/40 rounded-2xl p-8 shadow-gold"
      >
        <div className="flex flex-col items-center text-center">
          <Sparkles className="h-12 w-12 text-gold mb-4" />
          <h1 className="font-display text-3xl gradient-gold-text mb-2">{t("welcome.title")}</h1>
          <p className="text-sm text-muted-foreground mb-6">{t("welcome.subtitle")}</p>
          <div className="grid grid-cols-1 gap-2 w-full mb-6">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                  lang === l.code ? "border-gold bg-gold/10 text-gold" : "border-border hover:border-gold/40"
                }`}
              >
                <span className="text-xl">{l.flag}</span>
                <span className="font-medium">{l.label}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 w-full">
            <Button variant="hero" size="lg" onClick={() => { dismiss(); navigate({ to: "/auth", search: { next: "" } }); }}>
              {t("btn.get_started")}
            </Button>
            <Button variant="ghost" size="sm" onClick={dismiss}>
              {t("btn.continue")} →
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
