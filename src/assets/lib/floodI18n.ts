import type { TFunction } from "i18next";
import type { FloodDepth, FloodVehicleAccess } from "../../types";

export function floodDepthLabel(t: TFunction, value: FloodDepth | undefined): string | undefined {
  if (!value) return undefined;
  return t(`flood.depthOptions.${value}`);
}

export function floodVehicleLabel(
  t: TFunction,
  value: FloodVehicleAccess | undefined
): string | undefined {
  if (!value) return undefined;
  return t(`flood.vehicleOptions.${value}`);
}
