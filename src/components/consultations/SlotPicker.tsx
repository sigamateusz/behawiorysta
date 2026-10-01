import { formatSlotLabel, warsawDayHeading, warsawDayKey } from "@/lib/slot-label";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";
import { cn } from "@/lib/utils";

interface SlotPickerProps {
  slots: string[];
  selectedSlot: string;
  isActive: boolean;
  submitting: boolean;
  conflictError?: string | null;
  onSelect: (slot: string) => void;
  onBack: () => void;
}

interface SlotGroup {
  key: string;
  label: string;
  slots: string[];
}

function groupSlotsByDay(slots: string[]): SlotGroup[] {
  const groups = new Map<string, string[]>();
  for (const slot of slots) {
    const key = warsawDayKey(slot);
    const existing = groups.get(key);
    if (existing) {
      existing.push(slot);
    } else {
      groups.set(key, [slot]);
    }
  }
  return [...groups.entries()].map(([key, groupSlots]) => ({
    key,
    label: warsawDayHeading(groupSlots[0]),
    slots: groupSlots,
  }));
}

export function SlotPicker({
  slots,
  selectedSlot,
  isActive,
  submitting,
  conflictError,
  onSelect,
  onBack,
}: SlotPickerProps) {
  const groups = groupSlotsByDay(slots);

  return (
    <div className="space-y-4">
      <ServerError message={conflictError} />

      {slots.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-blue-100/80">
          Brak wolnych terminów w najbliższych 4 tygodniach
        </p>
      ) : (
        <div className="space-y-4" role="radiogroup" aria-label="Termin konsultacji">
          {groups.map((group) => (
            <section key={group.key}>
              <h3 className="mb-2 text-sm font-medium text-blue-100/80 capitalize">{group.label}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.slots.map((slot) => {
                  const selected = slot === selectedSlot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        onSelect(slot);
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "border-purple-400 bg-purple-600 text-white"
                          : "border-white/20 bg-white/10 text-white hover:bg-white/20",
                      )}
                    >
                      {formatSlotLabel(slot)}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <input type="hidden" name="slot_start" value={selectedSlot} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          onClick={onBack}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-medium text-white transition-colors hover:bg-white/20 sm:w-auto"
        >
          Wróć do ankiety
        </Button>
        <Button
          type={isActive ? "submit" : "button"}
          disabled={submitting || slots.length === 0 || selectedSlot === ""}
          className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500 sm:flex-1"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Wysyłanie...
            </span>
          ) : (
            "Wyślij zgłoszenie"
          )}
        </Button>
      </div>
    </div>
  );
}
