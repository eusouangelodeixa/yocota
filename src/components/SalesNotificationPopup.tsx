import { useState, useEffect, useRef } from "react";
import { ShoppingBag, X } from "lucide-react";

interface Props {
  messages: string[];
  intervalSeconds: number;
  displayDurationSeconds: number;
  position: "bottom-left" | "bottom-right";
}

export function SalesNotificationPopup({ messages, intervalSeconds, displayDurationSeconds, position }: Props) {
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!messages.length || dismissed) return;

    const showNext = () => {
      setCurrentIndex((prev) => prev % messages.length);
      setVisible(true);

      timerRef.current = setTimeout(() => {
        setVisible(false);
        timerRef.current = setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % messages.length);
          showNext();
        }, (intervalSeconds - displayDurationSeconds) * 1000);
      }, displayDurationSeconds * 1000);
    };

    // Initial delay before first notification
    timerRef.current = setTimeout(showNext, 5000);

    return () => clearTimeout(timerRef.current);
  }, [messages, intervalSeconds, displayDurationSeconds, dismissed]);

  if (!messages.length || dismissed) return null;

  const msg = messages[currentIndex];
  if (!msg) return null;

  // Parse "Nome - Cidade" format
  const parts = msg.split(" - ");
  const name = parts[0]?.trim() || msg;
  const city = parts[1]?.trim();
  const displayText = city
    ? `${name} de ${city} acabou de comprar este produto`
    : `${name} acabou de comprar este produto`;

  const positionClasses = position === "bottom-right" ? "right-4" : "left-4";

  return (
    <div
      className={`fixed bottom-4 ${positionClasses} z-[60] max-w-xs transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
      }`}
    >
      <div className="bg-[#1c2022] border border-[#27272a] rounded-xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex items-start gap-3">
        <div className="shrink-0 h-8 w-8 rounded-full bg-[rgba(40,213,106,0.12)] flex items-center justify-center mt-0.5">
          <ShoppingBag className="h-4 w-4 text-[#28d56a]" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-[#fafafa] leading-relaxed">{displayText}</p>
          <p className="text-[10px] text-[#52525b] mt-1">Agora mesmo</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-[#52525b] hover:text-[#a1a1aa] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
