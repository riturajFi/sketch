export interface TranscriptPromptInput {
  sourceName: string;
  text: string;
}

export function appendVoiceTranscript(userMessage: string, transcript: TranscriptPromptInput): string {
  const prefix = userMessage.trim();
  const block = [
    "<voice_transcripts>",
    `<transcript source="${transcript.sourceName}">`,
    transcript.text,
    "</transcript>",
    "</voice_transcripts>",
  ].join("\n");
  return prefix ? `${prefix}\n\n${block}` : block;
}
