import { useState } from "react";
import { BookOpen, Flag, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useStoryStore } from "@/store/storyStore";
import { toast } from "sonner";

interface Props {
  storyId: string;
  /** Called once both fields are saved successfully. */
  onComplete?: () => void;
}

/**
 * Story Setup Wizard — shown before Chapter 1 can be generated.
 * Requires BOTH "Beginning State" and "End Goal" to be filled in.
 */
export function StorySetupWizard({ storyId, onComplete }: Props) {
  const story = useStoryStore((s) => s.stories.find((st) => st.id === storyId)!);
  const updateStory = useStoryStore((s) => s.updateStory);
  const [beginning, setBeginning] = useState(story.beginningState ?? "");
  const [endGoal, setEndGoal] = useState(story.endGoal ?? "");

  const beginningOk = beginning.trim().length >= 10;
  const endGoalOk = endGoal.trim().length >= 10;
  const ready = beginningOk && endGoalOk;

  const save = () => {
    if (!ready) {
      toast.error("Beide velden moeten minstens 10 tekens bevatten.");
      return;
    }
    updateStory(storyId, { beginningState: beginning.trim(), endGoal: endGoal.trim() });
    toast.success("Verhaal-opzet opgeslagen — je kunt nu hoofdstuk 1 plannen.");
    onComplete?.();
  };

  return (
    <div
      data-testid="story-setup-wizard"
      className="bg-card border-2 border-gold/40 rounded-xl p-6 shadow-card space-y-5"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full gradient-gold flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-2xl">Verhaal-opzet wizard</h2>
          <p className="text-sm text-muted-foreground">
            Vóór hoofdstuk 1 gegenereerd kan worden, moet je vastleggen waar je verhaal begint en
            waar het naartoe moet. De AI gebruikt deze twee anker-punten in elk hoofdstuk.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wizard-beginning" className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gold" />
          Beginsituatie <span className="text-destructive">*</span>
          {beginningOk && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        </Label>
        <Textarea
          id="wizard-beginning"
          data-testid="wizard-beginning"
          rows={4}
          placeholder="Waar staan de personages en wereld als het verhaal opent? (politieke situatie, plek, recente gebeurtenissen...)"
          value={beginning}
          onChange={(e) => setBeginning(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Minimaal 10 tekens. {beginning.trim().length} ingevuld.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wizard-endgoal" className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-gold" />
          Einddoel <span className="text-destructive">*</span>
          {endGoalOk && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        </Label>
        <Textarea
          id="wizard-endgoal"
          data-testid="wizard-endgoal"
          rows={4}
          placeholder="Waar moet het verhaal uiteindelijk eindigen? (eindbestemming, climax, wie wint/verliest, welk thema...)"
          value={endGoal}
          onChange={(e) => setEndGoal(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Minimaal 10 tekens. {endGoal.trim().length} ingevuld.
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          variant="hero"
          size="lg"
          onClick={save}
          disabled={!ready}
          data-testid="wizard-save"
        >
          Opslaan en doorgaan
        </Button>
      </div>
    </div>
  );
}
