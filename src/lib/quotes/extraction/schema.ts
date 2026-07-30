// Strict validated schema for document-extraction output, version v1.
// Provider output that fails this schema is rejected and never parsed into
// takeoff or financial records. Providers must return null for anything the
// document does not actually state — inventing values is prohibited.
import { z } from "zod";

export const EXTRACTION_SCHEMA_VERSION = "v1";

const nullableString = z.string().trim().min(1).max(2000).nullable();
const nullableNumber = z.number().finite().nonnegative().nullable();

export const extractionTakeoffItemSchema = z.object({
  item_mark: nullableString,
  category: z.enum([
    "structural_steel",
    "platework",
    "handrail",
    "ladders",
    "grating",
    "bolts_hardware",
    "misc_metal",
    "coating_finish",
    "outside_service",
    "freight_delivery",
    "other",
  ]),
  description: nullableString,
  material: nullableString,
  grade: nullableString,
  profile: nullableString,
  size: nullableString,
  thickness: nullableString,
  width: nullableString,
  length: nullableString,
  quantity: nullableNumber,
  unit: nullableString,
  unit_weight_lbs: nullableNumber,
  linear_feet: nullableNumber,
  holes: nullableString,
  cuts: nullableString,
  bends: nullableString,
  welding: nullableString,
  finish: nullableString,
  notes: nullableString,
  source_page: nullableString,
  drawing_number: nullableString,
  drawing_revision: nullableString,
  /** Verbatim or concise evidence from the document. Required for every item. */
  evidence: z.string().trim().min(1).max(2000),
  confidence: z.enum(["low", "medium", "high"]),
});

export const extractionMissingInfoSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  category: z.enum([
    "material_grade",
    "quantity",
    "dimensions",
    "revision",
    "finish",
    "holes",
    "vendor_price",
    "delivery",
    "scope",
    "other",
  ]),
  severity: z.enum(["low", "normal", "high"]),
});

export const extractionOutputSchema = z.object({
  schema_version: z.literal(EXTRACTION_SCHEMA_VERSION),
  project_metadata: z.object({
    project_name: nullableString,
    customer_name: nullableString,
  }),
  drawing_metadata: z.object({
    drawing_numbers: z.array(z.string().trim().min(1).max(120)).max(200),
    revisions: z.array(z.string().trim().min(1).max(120)).max(200),
  }),
  takeoff_items: z.array(extractionTakeoffItemSchema).max(2000),
  handrail_total_linear_feet: nullableNumber,
  ladder_total_linear_feet: nullableNumber,
  finish_requirements: nullableString,
  outside_vendor_needs: z
    .array(
      z.object({
        category: z.enum([
          "steel_supplier",
          "detailer",
          "grating",
          "paint_coating",
          "powder_coating",
          "rubber_lining",
          "bolts_hardware",
          "freight",
          "outside_fabrication",
          "other",
        ]),
        description: z.string().trim().min(1).max(2000),
      }),
    )
    .max(100),
  missing_information: z.array(extractionMissingInfoSchema).max(200),
  warnings: z.array(z.string().trim().min(1).max(2000)).max(200),
});

export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
