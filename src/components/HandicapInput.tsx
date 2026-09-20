import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HandicapInputProps {
  /** Display string, e.g. "12.5" or "+2.4" */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Handicap entry with a sign toggle, so plus (better than scratch) handicaps can
 * be entered on mobile keypads that have no "+" key.
 */
export const HandicapInput = ({
  value,
  onChange,
  onBlur,
  id,
  placeholder = "0",
  disabled,
  className,
}: HandicapInputProps) => {
  const isPlus = value.trim().startsWith("+");

  const toggleSign = () => {
    const raw = value.trim();
    if (isPlus) {
      onChange(raw.slice(1));
    } else {
      onChange(`+${raw.replace(/^\+/, "")}`);
    }
  };

  const handleChange = (next: string) => {
    // Keep the plus prefix sticky while typing digits on a numeric keypad.
    const cleaned = next.replace(/\+/g, "");
    onChange(isPlus && cleaned !== "" ? `+${cleaned}` : cleaned);
  };

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <Button
        type="button"
        variant={isPlus ? "default" : "outline"}
        size="icon"
        disabled={disabled}
        onClick={toggleSign}
        aria-label={isPlus ? "Plus handicap (better than scratch) — tap for normal" : "Normal handicap — tap for plus"}
        title="Toggle plus handicap"
        className="shrink-0 w-10 font-semibold"
      >
        {isPlus ? "+" : "–"}
      </Button>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="flex-1 min-w-0"
      />
    </div>
  );
};

export default HandicapInput;
