import { useState } from "react";
import { User, Plus, Trash2, Save, Download } from "lucide-react";
import {
  getProfiles,
  getActiveProfile,
  setActiveProfile,
  addProfile,
  deleteProfile,
  saveProfileSettings,
  type LocalProfile,
  type ProfileSettings,
} from "../api/profiles";

/** Profile picker shared by upload mode and Intervals mode.
 *
 *  It's *stateful* in the sense that it owns the active-profile selection,
 *  but it doesn't own the form state — the parent passes the current form
 *  settings in via `currentSettings` (for "Save to profile") and receives
 *  a callback when a profile is loaded (for pre-filling the form).
 *
 *  The "Moi" profile is pre-seeded on first use and cannot be deleted.
 */
export default function ProfilePicker({
  currentSettings,
  onLoad,
  context,
}: {
  /** Current form state — used by the "Save to profile" button. */
  currentSettings: ProfileSettings;
  /** Called when the user clicks a profile or loads its settings. */
  onLoad: (settings: ProfileSettings) => void;
  /** "intervals" | "upload" — only used for the contextual tooltip. */
  context: "intervals" | "upload";
}) {
  const [profiles, setProfiles] = useState<LocalProfile[]>(() => getProfiles());
  const [active, setActive] = useState<LocalProfile>(() => getActiveProfile());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const refresh = () => {
    setProfiles(getProfiles());
    setActive(getActiveProfile());
  };

  const onPick = (key: string) => {
    setActiveProfile(key);
    const picked = getProfiles().find((p) => p.key === key);
    if (picked?.settings) onLoad(picked.settings);
    refresh();
  };

  const onAdd = () => {
    if (!newName.trim()) {
      setAdding(false);
      return;
    }
    // Snapshot the current form state into the new profile so the user
    // doesn't lose anything when cloning.
    addProfile(newName, { ...currentSettings });
    setNewName("");
    setAdding(false);
    refresh();
  };

  const onDelete = (key: string) => {
    if (key === "local:moi") return;
    if (confirm("Supprimer ce profil ?")) {
      deleteProfile(key);
      refresh();
    }
  };

  const onSaveToActive = () => {
    saveProfileSettings(currentSettings);
    refresh();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const onLoadActive = () => {
    const active = getActiveProfile();
    if (active.settings) onLoad(active.settings);
  };

  const helpText =
    context === "intervals"
      ? "Enregistre les identifiants Intervals, la masse, le vélo, la position et les filtres. Recharger un profil pré-remplit tous ces champs."
      : "Enregistre la masse, le vélo, la position et le Crr. Recharger un profil pré-remplit les champs du formulaire.";

  return (
    <div className="bg-panel border border-border rounded-lg p-3 mb-3">
      <div className="flex items-center gap-3 flex-wrap">
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
                title={isActive ? "Profil actif — cliquez pour recharger ses paramètres" : "Activer ce profil"}
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
            title="Créer un nouveau profil avec les paramètres actuels du formulaire"
          >
            <Plus size={11} /> Nouveau
          </button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={onLoadActive}
            className="text-[10px] px-2 py-1 rounded border border-border text-muted hover:border-info hover:text-info flex items-center gap-1"
            title="Recharger les paramètres enregistrés dans le profil actif"
          >
            <Download size={10} /> Recharger
          </button>
          <button
            onClick={onSaveToActive}
            className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1 transition ${
              savedFlash
                ? "border-teal text-teal bg-teal/10"
                : "border-border text-muted hover:border-teal hover:text-teal"
            }`}
            title="Sauvegarder les paramètres actuels du formulaire dans le profil actif"
          >
            <Save size={10} /> {savedFlash ? "Enregistré !" : "Sauvegarder"}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-muted mt-2 opacity-70">{helpText}</p>
    </div>
  );
}
