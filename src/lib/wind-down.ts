/** Wind-down defaults and wording. Pure data, no network. */

export type WindDownPhase = "thirty" | "sixty";

export type WindDownTaskDraft = {
  id?: string;
  label: string;
  phase: WindDownPhase;
  position: number;
  enabled: boolean;
};

/** Sensible starting checklist. "thirty" tasks appear in both modes. */
export const DEFAULT_WIND_DOWN_TASKS: { label: string; phase: WindDownPhase }[] = [
  { label: "Finish the important things for today", phase: "sixty" },
  { label: "Start putting the phone down", phase: "sixty" },
  { label: "Wash up / brush teeth / skincare", phase: "thirty" },
  { label: "Get tomorrow ready (clothes, bag, list)", phase: "sixty" },
  { label: "Make the room calm — lights low, tidy enough", phase: "thirty" },
  { label: "A glass of water", phase: "thirty" },
  { label: "Something relaxing — reading, stretching, breathing", phase: "thirty" },
  { label: "Into bed", phase: "thirty" },
];

export const DURATION_OPTIONS: { value: number; label: string; note: string }[] = [
  { value: 30, label: "30 minutes", note: "The short version" },
  { value: 60, label: "60 minutes", note: "A longer, slower run-up" },
];

export type CommunicationStyle = "calm" | "cute" | "motivational" | "funny" | "minimal" | "romantic";

export const COMMUNICATION_STYLES: { value: CommunicationStyle; label: string }[] = [
  { value: "calm", label: "Calm" },
  { value: "cute", label: "Cute" },
  { value: "motivational", label: "Motivational" },
  { value: "funny", label: "Funny" },
  { value: "minimal", label: "Minimal" },
  { value: "romantic", label: "Romantic" },
];

export function styleOf(value: string | null | undefined): CommunicationStyle {
  const match = COMMUNICATION_STYLES.find((option) => option.value === value);
  return match ? match.value : "calm";
}

type Copy = { intro: string; midway: string; done: string; reminder: string };

const COPY: Record<CommunicationStyle, Copy> = {
  calm: {
    intro: "No rush. A few small things, then bed.",
    midway: "You're partway there. Keep it slow.",
    done: "That's your wind-down done. Sleep well.",
    reminder: "A quiet nudge when it's time to start winding down.",
  },
  cute: {
    intro: "Cosy time! Let's get you ready for bed. 🌙",
    midway: "Look at you going. Nearly done!",
    done: "All snug and finished. Night night. 🌙",
    reminder: "A little tap on the shoulder when bedtime's coming.",
  },
  motivational: {
    intro: "This is the part that makes tomorrow easier. Let's go.",
    midway: "Good momentum — finish the list.",
    done: "Done. That's a real win for tonight.",
    reminder: "A prompt so tonight's routine actually happens.",
  },
  funny: {
    intro: "Operation Horizontal begins now.",
    midway: "Halfway. The bed is winning.",
    done: "Checklist crushed. Go be unconscious.",
    reminder: "A poke, so the phone doesn't eat your evening.",
  },
  minimal: {
    intro: "Wind-down.",
    midway: "Continuing.",
    done: "Complete.",
    reminder: "An in-app prompt at wind-down time.",
  },
  romantic: {
    intro: "Let the day go now. The night is yours.",
    midway: "Softly does it — a little more and you're there.",
    done: "The day is closed. Rest well, love.",
    reminder: "A gentle word when it's time to slow down.",
  },
};

export function windDownCopy(style: string | null | undefined): Copy {
  return COPY[styleOf(style)];
}
