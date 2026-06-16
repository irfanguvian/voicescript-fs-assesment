import { type FormEvent, useState } from 'react';
import { CITIES } from '../api/cities';
import type {
  CreateEditorInput,
  CreateReporterInput,
  Editor,
  Reporter,
} from '../api/types';
import { formatIdr } from '../format';

interface WorkersPanelProps {
  reporters: Reporter[];
  editors: Editor[];
  pending: boolean;
  onAddReporter: (input: CreateReporterInput) => void;
  onAddEditor: (input: CreateEditorInput) => void;
}

export function WorkersPanel({
  reporters,
  editors,
  pending,
  onAddReporter,
  onAddEditor,
}: WorkersPanelProps) {
  const [reporterName, setReporterName] = useState('');
  const [reporterCity, setReporterCity] = useState<string>(CITIES[0]);
  const [editorName, setEditorName] = useState('');

  function submitReporter(event: FormEvent) {
    event.preventDefault();
    onAddReporter({ name: reporterName.trim(), city: reporterCity });
    setReporterName('');
    setReporterCity(CITIES[0]);
  }

  function submitEditor(event: FormEvent) {
    event.preventDefault();
    onAddEditor({ name: editorName.trim() });
    setEditorName('');
  }

  return (
    <div className="card">
      <h2>Workers</h2>

      <h3>Reporters</h3>
      <ul className="worker-list">
        {reporters.map((reporter) => (
          <li key={reporter.reporter_id}>
            <span>
              {reporter.name} · {reporter.city}
            </span>
            <span className={`badge worker-${reporter.status.toLowerCase()}`}>
              {reporter.status}
            </span>
            <span className="balance">
              {formatIdr(reporter.balance?.current_balance ?? 0)}
            </span>
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={submitReporter}>
        <input
          type="text"
          required
          placeholder="Name"
          value={reporterName}
          onChange={(e) => setReporterName(e.target.value)}
        />
        <select
          value={reporterCity}
          onChange={(e) => setReporterCity(e.target.value)}
        >
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending}>
          Add
        </button>
      </form>

      <h3>Editors</h3>
      <ul className="worker-list">
        {editors.map((editor) => (
          <li key={editor.editor_id}>
            <span>{editor.name}</span>
            <span className={`badge worker-${editor.status.toLowerCase()}`}>
              {editor.status}
            </span>
            <span className="balance">
              {formatIdr(editor.balance?.current_balance ?? 0)}
            </span>
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={submitEditor}>
        <input
          type="text"
          required
          placeholder="Name"
          value={editorName}
          onChange={(e) => setEditorName(e.target.value)}
        />
        <button type="submit" disabled={pending}>
          Add
        </button>
      </form>
    </div>
  );
}
