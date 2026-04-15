import { useState, useEffect, useRef } from "react";
import { Zap, Timer } from "lucide-react";

interface Props {
  checkoutId: string;
  durationMinutes: number;
  text: string;
  expiredText?: string;
  bgColor: string;
  textColor: string;
}

export function CheckoutCountdownBar({ checkoutId, durationMinutes, text, expiredText, bgColor, textColor }: Props) {
  const storageKey = `countdown_${checkoutId}`;
  const [remaining, setRemaining] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const end = parseInt(saved, 10);
        const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
        return left;
      }
    } catch {}
    const total = durationMinutes * 60;
    try { sessionStorage.setItem(storageKey, String(Date.now() + total * 1000)); } catch {}
    return total;
  });

  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 0) { clearInterval(intervalRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const isExpired = remaining === 0;
  const finalExpiredText = expiredText || "O tempo acabou mas ainda podes comprar!";

  return (
    <div
      className="w-full py-2.5 px-4 flex items-center justify-center gap-2 text-sm font-semibold z-50 shrink-0"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {isExpired ? (
        <>
          <Timer className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: textColor }} />
          <span>{finalExpiredText}</span>
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: textColor }} />
          <span>{text}</span>
          <span className="tabular-nums font-bold text-base tracking-wider">{timeStr}</span>
        </>
      )}
    </div>
  );
}
