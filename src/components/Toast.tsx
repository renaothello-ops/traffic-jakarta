import { useEffect } from "react";

type Props = {
  message: string;
  onDone: () => void;
  durationMs?: number;
};

export default function Toast({ message, onDone, durationMs = 2800 }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDone, durationMs);
    return () => window.clearTimeout(t);
  }, [onDone, durationMs]);

  return (
    <div className="tj-toast" role="status">
      {message}
    </div>
  );
}
