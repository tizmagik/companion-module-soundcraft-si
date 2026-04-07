// Si Impact HiQnet parameter address mapping
//
// IMPORTANT: All object IDs and parameter IDs marked "TODO" must be verified
// using HiQnet Audio Architect (Windows). Procedure:
//   1. Add Si Impact device in Audio Architect (offline mode)
//   2. Drag controls onto the "Third-Party Controller" panel
//   3. Inspect the generated messages for exact Device Number, VD, Object, Param ID
//
// Confirmed values should have the TODO comment removed.

// Virtual device number for the Si Impact main surface
// TODO: verify with Audio Architect — typically 0x01 or 0x03
export const SI_IMPACT_VIRTUAL_DEVICE = 0x03

// Object ID helpers — returns [hi, mid, lo] byte triple
// TODO: verify channel/aux object addressing with Audio Architect
export function inputChannelObject(channel: number): [number, number, number] {
	// channel is 1-based (1–24)
	return [0x00, 0x00, channel]
}

export function auxObject(aux: number): [number, number, number] {
	// aux is 1-based (1–14)
	return [0x00, 0x01, aux]
}

export function fxReturnObject(fxReturn: number): [number, number, number] {
	// fxReturn is 1-based (1–4)
	return [0x00, 0x02, fxReturn]
}

// Well-known object addresses
// TODO: verify with Audio Architect
export const SiImpactObjects = {
	MAIN_LR: [0x00, 0x03, 0x01] as [number, number, number],
	MONO_CENTER: [0x00, 0x03, 0x02] as [number, number, number],
} as const

// Parameter IDs within a channel/object
// TODO: verify all with Audio Architect
export const SiImpactParamId = {
	MUTE: 0x0000, // BYTE: 0x00 = unmuted, 0x01 = muted
	FADER_LEVEL: 0x0001, // UWORD (ParamSetPercent): 0x0000–0xFFFF → 0–100%
	PREAMP_GAIN: 0x0002, // UWORD (ParamSetPercent): 0x0000–0xFFFF
	AUX_SEND_LEVEL: 0x0003, // UWORD (ParamSetPercent): 0x0000–0xFFFF
	AUX_SEND_MUTE: 0x0004, // BYTE: 0x00 = unmuted, 0x01 = muted
} as const

export type SiImpactParamId = (typeof SiImpactParamId)[keyof typeof SiImpactParamId]

// Human-readable labels for building Companion UI
export const INPUT_CHANNEL_COUNT = 24
export const AUX_COUNT = 14
export const FX_RETURN_COUNT = 4
