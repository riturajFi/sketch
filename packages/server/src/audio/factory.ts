import type { Config } from "../config";
import { OpenAiTranscriptionService } from "./openai";
import type { TranscriptionResult, TranscriptionService } from "./types";

const noTranscriptionService: TranscriptionService = {
  async transcribeFile(): Promise<TranscriptionResult> {
    throw new Error("Transcription is disabled");
  },
};

export function createTranscriptionService(config: Config): TranscriptionService {
  if (config.TRANSCRIPTION_PROVIDER === "openai") {
    if (!config.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required when TRANSCRIPTION_PROVIDER=openai");
    return new OpenAiTranscriptionService(config.OPENAI_API_KEY);
  }
  return noTranscriptionService;
}
