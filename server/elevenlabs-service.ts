const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

export async function generateSpeech(text: string, voiceId?: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log(`[ElevenLabs Mock] Would generate speech: "${text.substring(0, 80)}..."`);
    return null;
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId || DEFAULT_VOICE_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ElevenLabs] Speech generation failed: ${errText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`[ElevenLabs] Generated speech for: "${text.substring(0, 50)}..."`);
    return Buffer.from(arrayBuffer);
  } catch (err: any) {
    console.error(`[ElevenLabs] Error:`, err.message);
    return null;
  }
}

export async function getAvailableVoices(): Promise<any[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
      headers: { "xi-api-key": apiKey },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.voices || [];
  } catch {
    return [];
  }
}

export function generateCallScript(params: {
  employeeName: string;
  siteName: string;
  shiftTime: string;
  triggerType: "late_checkin" | "no_show" | "shift_cover" | "general";
}): string {
  const { employeeName, siteName, shiftTime, triggerType } = params;
  const firstName = employeeName.split(" ")[0];

  switch (triggerType) {
    case "late_checkin":
      return `Hello ${firstName}, this is the Gardeo control room calling. We noticed you haven't checked in for your ${shiftTime} shift at ${siteName}. Is everything alright? Are you on your way? Please check in through the app as soon as possible, or press 1 to confirm you're en route, press 2 if you're unable to attend today.`;

    case "no_show":
      return `Hello ${firstName}, this is an urgent call from the Gardeo control room. You were scheduled for a shift at ${siteName} starting at ${shiftTime}, but we haven't received a check-in from you. We need to confirm your status immediately. Press 1 if you're on your way, press 2 if you cannot attend, or press 3 to speak with the controller.`;

    case "shift_cover":
      return `Hello ${firstName}, this is the Gardeo control room. We have an urgent shift that needs covering at ${siteName} starting at ${shiftTime}. Based on your availability and location, we think you'd be a great fit. Press 1 if you can cover this shift, or press 2 if you're unavailable.`;

    case "general":
    default:
      return `Hello ${firstName}, this is the Gardeo control room calling regarding your shift at ${siteName}. Please call back the control room at your earliest convenience, or check the Gardeo app for details.`;
  }
}
