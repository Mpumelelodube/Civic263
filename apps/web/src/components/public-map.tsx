import { isOpenIncident, workflowLabel, type PublicIncident } from '@civic263/domain';

export function PublicMap({
  incidents,
  selectedId,
}: {
  incidents: PublicIncident[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const incident = incidents.find((item) => item.id === selectedId) ?? incidents[0];
  if (incident && !isOpenIncident(incident))
    return (
      <p className="empty">
        {workflowLabel(incident)}. This record remains in the register and is no longer shown on the
        active map.
      </p>
    );
  const point = incident?.location;
  if (!point)
    return (
      <p className="empty">
        {incident
          ? 'No public map position is available for this report.'
          : 'Choose a published report to view its location.'}
      </p>
    );
  const bbox = [
    point.longitude - 0.025,
    point.latitude - 0.015,
    point.longitude + 0.025,
    point.latitude + 0.015,
  ].join(',');
  return (
    <>
      {incident.communityResolution?.status === 'awaiting-confirmation' && (
        <p className="map-legend">
          Fix reported — awaiting an independent community visit. This pin remains active.
        </p>
      )}
      <iframe
        title={`Approximate location of ${incident.title}`}
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${point.latitude},${point.longitude}`}
        className="public-map"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <p className="map-legend">
        Approximate resident-reported position. Map data: OpenStreetMap contributors.
      </p>
    </>
  );
}
