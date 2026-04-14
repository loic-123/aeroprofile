import { useState } from "react";
import { User, Plus, Trash2 } from "lucide-react";
import {
  getProfiles,
  getActiveProfile,
  setActiveProfile,
  addProfile,
  deleteProfile,
  type LocalProfile,
} from "../api/profiles";

/** Small profile picker for upload-mode analyses.
 *
 *  The user picks (or creates) a local profile so that history entries
 *  are tagged with `athleteKey`, which is later used by HistoryPage's
 *  filter checkboxes and the rolling-std timeline to keep rides from
 *  different people separate.
 */
export default function ProfilePicker() {
  const [profiles, setProfiles] = useState<LocalProfile[]>(() => getProfiles());
  const [active, setActive] = useState<LocalProfile>(() => getActiveProfile());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const refresh = () => {
    setProfiles(getProfiles());
    setActive(getActiveProfile());
  };

  const onPick = (key: string) => {
    setActiveProfile(key);
    refresh();
  };

  const onAdd = () => {
    if (!newName.trim()) {
      setAdding(false);
      return;
    }
    addProfile(newName);
    setNewName("");
    setAdding(false);
    refresh();
  };

  const onDelete = (key: string) => {
    if (key === "local:moi") return; // keep the default
    if (confirm("Supprimer ce profil ?")) {
      deleteProfile(key);
      refresh();
    }
  };

  return (
    <div className="bg-panel border border-border rounded-lg p-3 mb-3 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted font-semibold">
        <User size={12} /> Profil :
      </div>
      {profiles.map((p) => {
        const isActive = p.key === active.key;
        return (
          <div key={p.key} className="flex items-center gap-0.5">
            <button
              onClick={() => onPick(p.key)}
              className={`text-xs px-2 py-1 rounded border font-mono transition ${
                isActive
                  ? "bg-teal/20 border-teal text-teal"
                  : "bg-bg border-border text-muted hover:border-muted"
              }`}
            >
              {p.name}
            </button>
            {p.key !== "local:moi" && isActive && (
              <button
                onClick={() => onDelete(p.key)}
                className="text-muted hover:text-coral p-1"
                title="Supprimer ce profil"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        );
      })}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAdd();
          }}
          className="flex items-center gap-1"
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom du profil"
            className="text-xs bg-bg border border-border rounded px-2 py-1 font-mono w-32"
            onBlur={() => setTimeout(() => setAdding(false), 150)}
          />
          <button
            type="submit"
            className="text-xs px-2 py-1 rounded border border-teal text-teal hover:bg-teal/10"
          >
            OK
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-xs px-2 py-1 rounded border border-border text-muted hover:border-teal hover:text-teal flex items-center gap-1"
        >
          <Plus size={11} /> Nouveau
        </button>
      )}
      <span className="text-[10px] text-muted ml-auto opacity-60">
        Garde les analyses de différents cyclistes séparées dans l'historique.
      </span>
    </div>
  );
}
