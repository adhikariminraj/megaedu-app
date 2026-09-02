"use client";

import { useGeography } from "@/lib/useGeography";

export type AddressFormValue = {
  provinceId: string;
  districtId: string;
  localLevelId: string;
  wardNumber: number | "";
  streetAddress: string;
  houseNumber: string;
};

export const EMPTY_ADDRESS: AddressFormValue = {
  provinceId: "",
  districtId: "",
  localLevelId: "",
  wardNumber: "",
  streetAddress: "",
  houseNumber: "",
};

const LOCAL_LEVEL_TYPE_LABEL: Record<string, string> = {
  METROPOLITAN_CITY: "Metropolitan City",
  SUB_METROPOLITAN_CITY: "Sub-Metropolitan City",
  MUNICIPALITY: "Municipality",
  RURAL_MUNICIPALITY: "Rural Municipality",
};

const fieldClass =
  "w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue disabled:bg-slate-50 disabled:text-slate-400";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

/**
 * The one reusable Nepal address form — Province -> District -> Local
 * Level -> Ward, plus Street/Locality and House Number. Shared by My
 * Profile (Current/Permanent), School Official Address, and (from
 * Phase C) Family/Emergency Contact addresses, so the cascading-filter
 * logic exists exactly once.
 *
 * Purely controlled: fetches the fixed geography reference tree itself
 * (via useGeography's shared cache) but holds no address state of its
 * own — the caller owns `value` and persists it however that page
 * already saves its own form (a Save button calling its own route),
 * matching every other form in this app.
 */
export default function AddressForm({
  value,
  onChange,
  disabled,
}: {
  value: AddressFormValue;
  onChange: (next: AddressFormValue) => void;
  disabled?: boolean;
}) {
  const { geography, error } = useGeography();

  if (error) {
    return <p className="text-sm text-mega-red">{error}</p>;
  }
  if (!geography) {
    return <p className="text-sm text-slate-400">Loading Nepal geography reference data...</p>;
  }

  const districts = geography.districts.filter((d) => d.provinceId === value.provinceId);
  const localLevels = geography.localLevels.filter((l) => l.districtId === value.districtId);
  const selectedLocalLevel = geography.localLevels.find((l) => l.id === value.localLevelId) || null;
  const wardOptions = selectedLocalLevel ? Array.from({ length: selectedLocalLevel.wardCount }, (_, i) => i + 1) : [];

  function handleProvinceChange(provinceId: string) {
    // Changing a higher-level selection clears every incompatible
    // lower-level one — a District/Local Level/Ward from the old
    // Province can never silently survive under the new one.
    onChange({ ...value, provinceId, districtId: "", localLevelId: "", wardNumber: "" });
  }
  function handleDistrictChange(districtId: string) {
    onChange({ ...value, districtId, localLevelId: "", wardNumber: "" });
  }
  function handleLocalLevelChange(localLevelId: string) {
    onChange({ ...value, localLevelId, wardNumber: "" });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Province</label>
          <select
            value={value.provinceId}
            onChange={(e) => handleProvinceChange(e.target.value)}
            disabled={disabled}
            className={fieldClass}
          >
            <option value="">Select Province</option>
            {geography.provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>District</label>
          <select
            value={value.districtId}
            onChange={(e) => handleDistrictChange(e.target.value)}
            disabled={disabled || !value.provinceId}
            className={fieldClass}
          >
            <option value="">{value.provinceId ? "Select District" : "Select a Province first"}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Municipality / Rural Municipality</label>
          <select
            value={value.localLevelId}
            onChange={(e) => handleLocalLevelChange(e.target.value)}
            disabled={disabled || !value.districtId}
            className={fieldClass}
          >
            <option value="">{value.districtId ? "Select Local Level" : "Select a District first"}</option>
            {localLevels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({LOCAL_LEVEL_TYPE_LABEL[l.type] || l.type})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Ward Number</label>
          <select
            value={value.wardNumber}
            onChange={(e) => onChange({ ...value, wardNumber: e.target.value ? Number(e.target.value) : "" })}
            disabled={disabled || !value.localLevelId}
            className={fieldClass}
          >
            <option value="">{selectedLocalLevel ? "Select Ward" : "Select a Local Level first"}</option>
            {wardOptions.map((w) => (
              <option key={w} value={w}>
                Ward {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Street Address / Locality</label>
          <input
            value={value.streetAddress}
            onChange={(e) => onChange({ ...value, streetAddress: e.target.value })}
            disabled={disabled}
            placeholder="Tole / street / locality"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>House Number</label>
          <input
            value={value.houseNumber}
            onChange={(e) => onChange({ ...value, houseNumber: e.target.value })}
            disabled={disabled}
            className={fieldClass}
          />
        </div>
      </div>
    </div>
  );
}
