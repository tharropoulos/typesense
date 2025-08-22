import { describe, it, expect, beforeAll } from "bun:test";
import { Phases } from "../src/constants";
import { z } from "zod";
import { fetchSingleNode } from "../src/request";
import { CreateNLSearchModelResponse } from "./types";

const ErrorResponse = z.object({
  message: z.string(),
});
const models = {
  regular: "regular-model",
  oSeries: "o-series-model",
  gpt5: "gpt5-model",
} as const;

beforeAll(async () => {
  for (const model of Object.values(models)) {
    await fetchSingleNode(`/nl_search_models/${model}`, {
      method: "DELETE",
    });
  }
});

describe(Phases.SINGLE_FRESH, () => {
  it("should create a regular OpenAI model successfully", async () => {
    const res = await fetchSingleNode("/nl_search_models", {
      method: "POST",
      body: JSON.stringify({
        id: "regular-model",
        model_name: "openai/gpt-4",
        api_key: Bun.env.OPEN_AI_API_KEY ?? "sk-random",
        temperature: 0.7,
        max_bytes: 1000,
      }),
    });

    const data = CreateNLSearchModelResponse.safeParse(await res.json());
    expect(data.data?.id).toBe("regular-model");
    expect(data.data?.model_name).toBe("openai/gpt-4");
    expect(data.data?.temperature).toBe(0.7);
    expect(data.data?.max_bytes).toBe(1000);
  });

  it("should create an O-series model successfully without temperature", async () => {
    const res = await fetchSingleNode("/nl_search_models", {
      method: "POST",
      body: JSON.stringify({
        id: "o-series-model",
        model_name: "openai/o1-mini",
        api_key: Bun.env.OPEN_AI_API_KEY ?? "sk-random",
        max_bytes: 1000,
      }),
    });

    expect(res.ok).toBe(true);
    const data = CreateNLSearchModelResponse.safeParse(await res.json());
    expect(data.success).toBe(true);
    expect(data.data?.id).toBe("o-series-model");
    expect(data.data?.model_name).toBe("openai/o1-mini");
    expect(data.data?.temperature).toBeUndefined();
    expect(data.data?.max_bytes).toBe(1000);
  });

  it("should create a GPT-5 model successfully without temperature", async () => {
    const res = await fetchSingleNode("/nl_search_models", {
      method: "POST",
      body: JSON.stringify({
        id: "gpt5-model",
        model_name: "openai/gpt-5",
        api_key: Bun.env.OPEN_AI_API_KEY ?? "sk-random",
        max_bytes: 1000,
      }),
    });

    expect(res.ok).toBe(true);
    const data = CreateNLSearchModelResponse.safeParse(await res.json());
    expect(data.success).toBe(true);
    expect(data.data?.id).toBe("gpt5-model");
    expect(data.data?.model_name).toBe("openai/gpt-5");
    expect(data.data?.temperature).toBeUndefined();
    expect(data.data?.max_bytes).toBe(1000);
  });

  it("should reject O-series model with temperature parameter", async () => {
    const res = await fetchSingleNode("/nl_search_models", {
      method: "POST",
      body: JSON.stringify({
        id: "o-series-with-temp",
        model_name: "openai/o1-mini",
        api_key: Bun.env.OPEN_AI_API_KEY ?? "sk-random",
        temperature: 0.7,
        max_bytes: 1000,
      }),
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    const data = ErrorResponse.safeParse(await res.json());
    expect(data.success).toBe(true);
    expect(data.data?.message).toContain("Property `temperature` is not supported for the o-series and gpt-5 models");
  });

  it("should reject GPT-5 model with temperature parameter", async () => {
    const res = await fetchSingleNode("/nl_search_models", {
      method: "POST",
      body: JSON.stringify({
        id: "gpt5-with-temp",
        model_name: "openai/gpt-5",
        api_key: Bun.env.OPEN_AI_API_KEY ?? "sk-random",
        temperature: 0.7,
        max_bytes: 1000,
      }),
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    const data = ErrorResponse.safeParse(await res.json());
    expect(data.success).toBe(true);
    expect(data.data?.message).toContain("Property `temperature` is not supported for the o-series and gpt-5 models");
  });

  it("should reject model without required fields", async () => {
    const res = await fetchSingleNode("/nl_search_models", {
      method: "POST",
      body: JSON.stringify({
        id: "invalid-model",
        model_name: "openai/gpt-4",
        max_bytes: 1000,
        // Missing api_key
      }),
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    const data = ErrorResponse.safeParse(await res.json());
    expect(data.success).toBe(true);
    expect(data.data?.message).toContain("Property `api_key` is missing or is not a non-empty string");
  });

  it("should reject model with empty API key", async () => {
    const res = await fetchSingleNode("/nl_search_models", {
      method: "POST",
      body: JSON.stringify({
        id: "empty-api-key-model",
        model_name: "openai/gpt-4",
        api_key: "",
        max_bytes: 1000,
      }),
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    const data = ErrorResponse.safeParse(await res.json());
    expect(data.success).toBe(true);
    expect(data.data?.message).toContain("Property `api_key` is missing or is not a non-empty string");
  });
});

describe(Phases.SINGLE_RESTARTED, () => {
  it("should retrieve created models after restart", async () => {
    // Test regular model
    const regularRes = await fetchSingleNode("/nl_search_models/regular-model");
    expect(regularRes.ok).toBe(true);
    const regularData = CreateNLSearchModelResponse.safeParse(await regularRes.json());
    expect(regularData.success).toBe(true);
    expect(regularData.data?.id).toBe("regular-model");
    expect(regularData.data?.model_name).toBe("openai/gpt-4");

    // Test O-series model
    const oSeriesRes = await fetchSingleNode("/nl_search_models/o-series-model");
    expect(oSeriesRes.ok).toBe(true);
    const oSeriesData = CreateNLSearchModelResponse.safeParse(await oSeriesRes.json());
    expect(oSeriesData.success).toBe(true);
    expect(oSeriesData.data?.id).toBe("o-series-model");
    expect(oSeriesData.data?.model_name).toBe("openai/o1-mini");

    // Test GPT-5 model
    const gpt5Res = await fetchSingleNode("/nl_search_models/gpt5-model");
    expect(gpt5Res.ok).toBe(true);
    const gpt5Data = CreateNLSearchModelResponse.safeParse(await gpt5Res.json());
    expect(gpt5Data.success).toBe(true);
    expect(gpt5Data.data?.id).toBe("gpt5-model");
    expect(gpt5Data.data?.model_name).toBe("openai/gpt-5");
  });

  it("should list all models correctly", async () => {
    const res = await fetchSingleNode("/nl_search_models");
    expect(res.ok).toBe(true);
    const data = (await res.json()) as z.infer<typeof CreateNLSearchModelResponse>[];

    const modelIds = data.map((model: z.infer<typeof CreateNLSearchModelResponse>) => model.id);
    expect(modelIds).toContain("regular-model");
    expect(modelIds).toContain("o-series-model");
    expect(modelIds).toContain("gpt5-model");
  });
});

describe(Phases.SINGLE_SNAPSHOT, () => {
  it("should retrieve models after snapshot and restart", async () => {
    // Test regular model
    const regularRes = await fetchSingleNode("/nl_search_models/regular-model");
    expect(regularRes.ok).toBe(true);
    const regularData = CreateNLSearchModelResponse.safeParse(await regularRes.json());
    expect(regularData.success).toBe(true);
    expect(regularData.data?.id).toBe("regular-model");

    // Test O-series model
    const oSeriesRes = await fetchSingleNode("/nl_search_models/o-series-model");
    expect(oSeriesRes.ok).toBe(true);
    const oSeriesData = CreateNLSearchModelResponse.safeParse(await oSeriesRes.json());
    expect(oSeriesData.success).toBe(true);
    expect(oSeriesData.data?.id).toBe("o-series-model");

    // Test GPT-5 model
    const gpt5Res = await fetchSingleNode("/nl_search_models/gpt5-model");
    expect(gpt5Res.ok).toBe(true);
    const gpt5Data = CreateNLSearchModelResponse.safeParse(await gpt5Res.json());
    expect(gpt5Data.success).toBe(true);
    expect(gpt5Data.data?.id).toBe("gpt5-model");
  });
});
