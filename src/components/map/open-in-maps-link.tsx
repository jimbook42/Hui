import { HuiLinkButton } from "@/components/hui/hui-button";
import { buildExternalMapsUrl, type EventCoordinates } from "@/domain/events/location";

type OpenInMapsLinkProps = {
  location: string | null;
  coordinates: EventCoordinates | null;
  className?: string;
};

export function OpenInMapsLink({ location, coordinates, className }: OpenInMapsLinkProps) {
  const href = buildExternalMapsUrl(location, coordinates);
  if (!href) {
    return null;
  }

  return (
    <HuiLinkButton href={href} variant="soft" size="sm" className={className} target="_blank" rel="noopener noreferrer">
      Open in Maps
    </HuiLinkButton>
  );
}
