import { type FormEvent, useState } from 'react';
import { CITIES } from '../api/cities';
import type { CreateJobInput, LocationType } from '../api/types';

interface CreateJobFormProps {
  pending: boolean;
  onCreate: (input: CreateJobInput) => void;
}

export function CreateJobForm({ pending, onCreate }: CreateJobFormProps) {
  const [caseName, setCaseName] = useState('');
  const [duration, setDuration] = useState('60');
  const [locationType, setLocationType] = useState<LocationType>('REMOTE');
  const [city, setCity] = useState<string>(CITIES[0]);

  const isPhysical = locationType === 'PHYSICAL';

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onCreate({
      case_name: caseName.trim(),
      duration_minutes: Number(duration),
      location_type: locationType,
      city: isPhysical ? city : undefined,
    });
    setCaseName('');
    setCity(CITIES[0]);
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h2>Create job</h2>
      <label>
        Case name
        <input
          type="text"
          required
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
        />
      </label>
      <label>
        Duration (minutes)
        <input
          type="number"
          min={1}
          required
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
      </label>
      <label>
        Location
        <select
          value={locationType}
          onChange={(e) => setLocationType(e.target.value as LocationType)}
        >
          <option value="REMOTE">REMOTE</option>
          <option value="PHYSICAL">PHYSICAL</option>
        </select>
      </label>
      {isPhysical && (
        <label>
          City
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" disabled={pending}>
        Create job
      </button>
    </form>
  );
}
