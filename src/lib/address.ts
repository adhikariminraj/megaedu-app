import { prisma } from "@/lib/prisma";

export type AddressInput = {
  provinceId?: unknown;
  districtId?: unknown;
  localLevelId?: unknown;
  wardNumber?: unknown;
  streetAddress?: unknown;
  houseNumber?: unknown;
};

export type ValidatedAddress = {
  provinceId: string;
  districtId: string;
  localLevelId: string;
  wardNumber: number;
  streetAddress: string | null;
  houseNumber: string | null;
};

/**
 * Server-side source of truth for "is this a valid, internally
 * consistent Nepal address" — the AddressForm component already keeps
 * the UI from constructing an inconsistent one, but every write route
 * re-validates here rather than trusting the client. Checks the full
 * Province -> District -> Local Level chain actually links up, and that
 * wardNumber falls inside the selected Local Level's real ward range
 * (mirroring AcademicSession's existing app-level-constraint idiom —
 * there is no DB-level way to express this in SQLite).
 *
 * All six fields are required for a saved Address row — this app has no
 * concept of a half-filled structured address; a person or school with
 * incomplete address information simply has no Address row yet.
 */
export async function validateAddressInput(input: AddressInput): Promise<{ error: string } | ValidatedAddress> {
  const provinceId = typeof input.provinceId === "string" ? input.provinceId : "";
  const districtId = typeof input.districtId === "string" ? input.districtId : "";
  const localLevelId = typeof input.localLevelId === "string" ? input.localLevelId : "";
  const wardNumber = typeof input.wardNumber === "number" ? input.wardNumber : NaN;
  const streetAddress = typeof input.streetAddress === "string" ? input.streetAddress.trim() : "";
  const houseNumber = typeof input.houseNumber === "string" ? input.houseNumber.trim() : "";

  if (!provinceId || !districtId || !localLevelId || !Number.isInteger(wardNumber)) {
    return { error: "Province, District, Local Level, and Ward Number are all required." };
  }

  const localLevel = await prisma.localLevel.findUnique({ where: { id: localLevelId } });
  if (!localLevel || localLevel.districtId !== districtId) {
    return { error: "The selected Local Level does not belong to the selected District." };
  }
  const district = await prisma.district.findUnique({ where: { id: districtId } });
  if (!district || district.provinceId !== provinceId) {
    return { error: "The selected District does not belong to the selected Province." };
  }
  if (wardNumber < 1 || wardNumber > localLevel.wardCount) {
    return { error: `Ward Number must be between 1 and ${localLevel.wardCount} for ${localLevel.name}.` };
  }

  return {
    provinceId,
    districtId,
    localLevelId,
    wardNumber,
    streetAddress: streetAddress || null,
    houseNumber: houseNumber || null,
  };
}

export function isAddressError(result: { error: string } | ValidatedAddress): result is { error: string } {
  return "error" in result;
}
