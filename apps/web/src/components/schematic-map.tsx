import { isOpenIncident, type PublicIncident } from '@civic263/domain';
import { DEMO_INCIDENTS, DEMO_POSITIONS } from '../data/demo-incidents';

export function SchematicMap({
  incidents,
  selectedId,
  onSelect,
}: {
  incidents: PublicIncident[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <div className="map-canvas" aria-label="Schematic positions of fictional issues">
        <svg
          viewBox="0 0 700 420"
          preserveAspectRatio="none"
          role="img"
          aria-label="Illustrative street layout, not a geographic basemap"
        >
          <rect width="700" height="420" fill="#f2f4f3" />
          <g fill="#e5e9e7">
            <path d="M40 20h125v88H40zM205 22h165v78H205zM430 15h225v85H430zM32 161h130v75H32zM220 157h145v80H220zM430 162h225v76H430zM28 298h137v98H28zM218 295h152v103H218zM433 294h218v102H433z" />
          </g>
          <g stroke="white" strokeWidth="16">
            <path d="M0 132L700 130M0 267L700 269M189 0L190 420M395 0L397 420M0 415L700 20" />
          </g>
        </svg>
        {incidents.map((incident) => {
          const index = DEMO_INCIDENTS.findIndex((item) => item.id === incident.id);
          const position = DEMO_POSITIONS[index];
          if (!position) return null;
          return (
            <button
              key={incident.id}
              className={`map-pin ${isOpenIncident(incident) ? '' : 'resolved'} ${selectedId === incident.id ? 'selected' : ''}`}
              style={{ left: `${position[0]}%`, top: `${position[1]}%` }}
              onClick={() => onSelect(incident.id)}
              aria-label={`${incident.title}, ${isOpenIncident(incident) ? 'open' : 'resolution recorded'}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <div className="map-legend">
        <span>
          <i />
          Open issue
        </span>
        <span>
          <i className="hollow" />
          Resolution recorded
        </span>
        <span>Schematic, fictional positions</span>
      </div>
    </>
  );
}
