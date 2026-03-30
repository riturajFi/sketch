export interface TranscriptionInput {
  filePath: string;
  mimeType: string;
  fileName: string;
}

export interface TranscriptionResult {
  text: string;
  provider: "none" | "openai";
}

export interface TranscriptionService {
  transcribeFile(input: TranscriptionInput): Promise<TranscriptionResult>;
}
