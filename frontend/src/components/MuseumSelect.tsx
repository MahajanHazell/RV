
type MuseumOption = {
  id: string;
  name: string;
};

const MUSEUMS: MuseumOption[] = [
  {
    id: "f817a6f8-8f99-4618-86a2-603d0b323eff",
    name: "Buffalo AKG Art Museum",
  },
  // Add more museums here later
];

export default function MuseumSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="form-group">
      <label className="label">Museum</label>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a museum…</option>
        {MUSEUMS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <div className="hint">More museums can be added anytime.</div>
    </div>
  );
}

