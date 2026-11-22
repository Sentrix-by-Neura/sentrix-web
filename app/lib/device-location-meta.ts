export type DeviceLocationMeta = {
  unitName?: string;
  roomLocation?: string;
  locationPhotoUrl?: string;
};

const STORAGE_PREFIX = "sentrix_device_location_meta_v1:";

function storageKey(userId: string | null) {
  return `${STORAGE_PREFIX}${userId || "anon"}`;
}

export function loadAllDeviceLocationMeta(userId: string | null): Record<string, DeviceLocationMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, DeviceLocationMeta> : {};
  } catch {
    return {};
  }
}

export function saveDeviceLocationMeta(
  userId: string | null,
  deviceId: string,
  meta: DeviceLocationMeta,
): Record<string, DeviceLocationMeta> {
  const all = loadAllDeviceLocationMeta(userId);
  const cleaned: DeviceLocationMeta = {
    unitName: meta.unitName?.trim() || undefined,
    roomLocation: meta.roomLocation?.trim() || undefined,
    locationPhotoUrl: meta.locationPhotoUrl || undefined,
  };
  if (!cleaned.unitName && !cleaned.roomLocation && !cleaned.locationPhotoUrl) {
    delete all[deviceId];
  } else {
    all[deviceId] = cleaned;
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(all));
    } catch {
      throw new Error("Could not save location details. Try a smaller photo.");
    }
  }
  return all;
}

export function resizeLocationPhoto(file: File, maxDimension = 640): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Please choose an image file (JPG, PNG, or WebP)."));
  }
  if (file.size > 10 * 1024 * 1024) {
    return Promise.reject(new Error("Image is too large. Please choose a photo under 10 MB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image preview."));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process image."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
