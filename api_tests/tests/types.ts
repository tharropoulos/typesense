import z from "zod";

export const CreateNLSearchModelResponse = z.object({
  id: z.string(),
  model_name: z.string(),
  api_key: z.string(),
  max_bytes: z.number(),
  temperature: z.number().optional(),
});

export const CreateCollectionResponse = z.object({
  created_at: z.number(),
  default_sorting_field: z.string(),
  enable_nested_fields: z.boolean(),
  fields: z.array(
    z.object({
      facet: z.boolean(),
      index: z.boolean(),
      infix: z.boolean(),
      locale: z.string(),
      name: z.string(),
      optional: z.boolean(),
      sort: z.boolean(),
      stem: z.boolean(),
      stem_dictionary: z.string(),
      store: z.boolean(),
      type: z.string(),
    })
  ),
  name: z.string(),
  num_documents: z.number(),
  symbols_to_index: z.array(z.string()),
  token_separators: z.array(z.string()),
});
