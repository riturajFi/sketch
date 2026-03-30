import fs from "node:fs";
import OpenAI from "openai";
import type { TranscriptionInput, TranscriptionResult, TranscriptionService } from "./types";

export class OpenAiTranscriptionService implements TranscriptionService {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async transcribeFile(input: TranscriptionInput): Promise<TranscriptionResult> {
    const transcription = await this.client.audio.transcriptions.create({
      file: fs.createReadStream(input.filePath),
      model: "gpt-4o-transcribe",
    });
    if (!transcription.text?.trim()) throw new Error("OpenAI transcription returned empty text");
    return { text: transcription.text.trim(), provider: "openai" };
  }
}
