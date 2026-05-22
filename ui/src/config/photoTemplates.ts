export interface PhotoTemplate {
  id: string;
  label: string;
  description?: string;
}

export const DEFAULT_PHOTO_TEMPLATE = "default";

export const PHOTO_TEMPLATES: Record<string, PhotoTemplate[]> = {
  "Astro Awani": [
    {
      id: "awani_v1",
      label: "Default",
      description: "Default design Template",
    },
    {
      id: "awani_v2",
      label: "Terkini",
      description: "Terkini design template",
    },
  ],
};

export function getPhotoTemplatesForBrand(brand: string): PhotoTemplate[] {
  return PHOTO_TEMPLATES[brand] ?? [];
}

export function getDefaultTemplateForBrand(brand: string): string {
  const templates = getPhotoTemplatesForBrand(brand);
  return templates[0]?.id ?? DEFAULT_PHOTO_TEMPLATE;
}
