import { TriangleAlert } from "lucide-react";

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-coral/35 bg-coral/10 p-4 text-sm text-coral-ink">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
