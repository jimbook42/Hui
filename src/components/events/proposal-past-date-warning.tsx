import { HuiSurface } from "@/components/hui/hui-surface";

type ProposalPastDateWarningProps = {
  title: string;
  detail: string;
};

export function ProposalPastDateWarning({ title, detail }: ProposalPastDateWarningProps) {
  return (
    <HuiSurface tone="clay" shape="soft" padding="md" className="hui-rise-2" role="status">
      <p className="text-sm font-extrabold text-foreground">{title}</p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">{detail}</p>
    </HuiSurface>
  );
}
