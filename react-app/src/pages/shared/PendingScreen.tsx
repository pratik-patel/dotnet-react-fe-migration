import { MvcLayout } from "../../components/shared/MvcLayout";

interface PendingScreenProps {
  featureLabel: string;
}

export function PendingScreen({ featureLabel }: PendingScreenProps) {
  return (
    <MvcLayout>
      <h2>{featureLabel}</h2>
      <p>This feature is not yet migrated in this run.</p>
      <p>Navigation contract is preserved so linked routes remain reachable.</p>
    </MvcLayout>
  );
}
