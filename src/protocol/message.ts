// HiQNet binary message encode/decode
//
// Wire format (big-endian throughout):
//   Byte  0     : Version = 0x02
//   Byte  1     : Header Length (25 or 27)
//   Bytes 2–5   : Message Length (total bytes, including header)
//   Bytes 6–7   : Source Device Number
//   Byte  8     : Source Virtual Device
//   Bytes 9–11  : Source Object [hi, mid, lo]
//   Bytes 12–13 : Destination Device Number
//   Byte  14    : Destination Virtual Device
//   Bytes 15–17 : Destination Object [hi, mid, lo]
//   Bytes 18–19 : Message ID
//   Bytes 20–21 : Flags
//   Bytes 22–23 : Hop Count
//   Bytes 24–25 : Sequence Number   ← note: spec says byte 24 starts seq#
//   Bytes 26–27 : Session Number (optional, present when Flags bit 6 set)

import {
	HIQNET_VERSION,
	HIQNET_HEADER_LEN,
	HiqnetFlags,
	HiqnetMessageId,
	HiqnetDataType,
	SOURCE_DEVICE_ADDRESS,
	SOURCE_VIRTUAL_DEVICE,
	SOURCE_OBJECT,
	BROADCAST_DEVICE_ADDRESS,
	BROADCAST_VIRTUAL_DEVICE,
	BROADCAST_OBJECT,
} from './constants.js'

export interface HiqnetAddress {
	deviceNumber: number
	virtualDevice: number
	object: [number, number, number]
}

export interface HiqnetHeader {
	version: number
	headerLength: number
	messageLength: number
	source: HiqnetAddress
	destination: HiqnetAddress
	messageId: number
	flags: number // raw 16-bit flags word; use HiqnetFlags constants to test bits
	hopCount: number
	sequenceNumber: number
	sessionNumber?: number
}

// ─── Decode ──────────────────────────────────────────────────────────────────

export function decodeHeader(buf: Buffer): HiqnetHeader {
	const version = buf.readUInt8(0)
	const headerLength = buf.readUInt8(1)
	const messageLength = buf.readUInt32BE(2)
	const sourceDeviceNumber = buf.readUInt16BE(6)
	const sourceVirtualDevice = buf.readUInt8(8)
	const sourceObject: [number, number, number] = [buf.readUInt8(9), buf.readUInt8(10), buf.readUInt8(11)]
	const destDeviceNumber = buf.readUInt16BE(12)
	const destVirtualDevice = buf.readUInt8(14)
	const destObject: [number, number, number] = [buf.readUInt8(15), buf.readUInt8(16), buf.readUInt8(17)]
	const messageId = buf.readUInt16BE(18)
	const flags = buf.readUInt16BE(20)
	const hopCount = buf.readUInt16BE(22)
	const sequenceNumber = buf.readUInt16BE(24)

	const header: HiqnetHeader = {
		version,
		headerLength,
		messageLength,
		source: { deviceNumber: sourceDeviceNumber, virtualDevice: sourceVirtualDevice, object: sourceObject },
		destination: { deviceNumber: destDeviceNumber, virtualDevice: destVirtualDevice, object: destObject },
		messageId,
		flags,
		hopCount,
		sequenceNumber,
	}

	if (flags & HiqnetFlags.SESSION_NUMBER && headerLength >= 27) {
		header.sessionNumber = buf.readUInt16BE(26)
	}

	return header
}

// ─── Encode ──────────────────────────────────────────────────────────────────

function encodeHeader(header: HiqnetHeader): Buffer {
	const buf = Buffer.alloc(header.headerLength)
	buf.writeUInt8(header.version, 0)
	buf.writeUInt8(header.headerLength, 1)
	buf.writeUInt32BE(header.messageLength, 2)
	buf.writeUInt16BE(header.source.deviceNumber, 6)
	buf.writeUInt8(header.source.virtualDevice, 8)
	buf.writeUInt8(header.source.object[0], 9)
	buf.writeUInt8(header.source.object[1], 10)
	buf.writeUInt8(header.source.object[2], 11)
	buf.writeUInt16BE(header.destination.deviceNumber, 12)
	buf.writeUInt8(header.destination.virtualDevice, 14)
	buf.writeUInt8(header.destination.object[0], 15)
	buf.writeUInt8(header.destination.object[1], 16)
	buf.writeUInt8(header.destination.object[2], 17)
	buf.writeUInt16BE(header.messageId, 18)
	buf.writeUInt16BE(header.flags, 20)
	buf.writeUInt16BE(header.hopCount, 22)
	buf.writeUInt16BE(header.sequenceNumber, 24)
	if (header.sessionNumber !== undefined && header.headerLength >= 27) {
		buf.writeUInt16BE(header.sessionNumber, 26)
	}
	return buf
}

// ─── Message builder helpers ──────────────────────────────────────────────────

function buildMessage(messageId: number, dest: HiqnetAddress, payload: Buffer, seqNum: number, flags = 0): Buffer {
	const headerLength = HIQNET_HEADER_LEN
	const messageLength = headerLength + payload.length
	const header = encodeHeader({
		version: HIQNET_VERSION,
		headerLength,
		messageLength,
		source: {
			deviceNumber: SOURCE_DEVICE_ADDRESS,
			virtualDevice: SOURCE_VIRTUAL_DEVICE,
			object: SOURCE_OBJECT,
		},
		destination: dest,
		messageId,
		flags,
		hopCount: 5,
		sequenceNumber: seqNum,
	})
	return Buffer.concat([header, payload])
}

// ─── Public builders ─────────────────────────────────────────────────────────

/**
 * DiscoInfo (0x0000) — broadcast keep-alive / device discovery.
 * No payload; sent periodically to maintain the TCP session.
 */
export function buildDiscoInfo(seqNum: number): Buffer {
	return buildMessage(
		HiqnetMessageId.DISCO_INFO,
		{ deviceNumber: BROADCAST_DEVICE_ADDRESS, virtualDevice: BROADCAST_VIRTUAL_DEVICE, object: BROADCAST_OBJECT },
		Buffer.alloc(0),
		seqNum,
	)
}

/**
 * MultiParamGet (0x0103) — request the current value of one or more parameters.
 * Payload: [paramCount (1B)] + [paramId (2B)] × paramCount
 */
export function buildMultiParamGet(dest: HiqnetAddress, paramIds: number[], seqNum: number): Buffer {
	const payload = Buffer.alloc(1 + paramIds.length * 2)
	payload.writeUInt8(paramIds.length, 0)
	for (let i = 0; i < paramIds.length; i++) {
		payload.writeUInt16BE(paramIds[i], 1 + i * 2)
	}
	return buildMessage(HiqnetMessageId.MULTI_PARAM_GET, dest, payload, seqNum)
}

/**
 * MultiParamSet (0x0100) — set a BYTE parameter (e.g. mute: 0x00/0x01).
 * Payload: [paramCount (1B)] + [paramId (2B), dataType (1B), value (1B)] × paramCount
 */
export function buildMultiParamSetByte(dest: HiqnetAddress, paramId: number, value: number, seqNum: number): Buffer {
	const payload = Buffer.alloc(1 + 4) // 1 param: count(1) + id(2) + type(1) + val(1)
	payload.writeUInt8(1, 0) // param count
	payload.writeUInt16BE(paramId, 1)
	payload.writeUInt8(HiqnetDataType.BYTE, 3)
	payload.writeUInt8(value & 0xff, 4)
	return buildMessage(HiqnetMessageId.MULTI_PARAM_SET, dest, payload, seqNum)
}

/**
 * ParamSetPercent (0x0102) — set a parameter as a percentage (0–100 → 0x0000–0xFFFF).
 * Payload: [paramCount (1B)] + [paramId (2B), value (2B UWORD)] × paramCount
 */
export function buildParamSetPercent(
	dest: HiqnetAddress,
	paramId: number,
	percent: number, // 0.0–100.0
	seqNum: number,
): Buffer {
	const raw = Math.round(Math.max(0, Math.min(100, percent)) * 655.35) // → 0–65535
	const payload = Buffer.alloc(1 + 4) // count(1) + id(2) + val(2)
	payload.writeUInt8(1, 0)
	payload.writeUInt16BE(paramId, 1)
	payload.writeUInt16BE(raw, 3)
	return buildMessage(HiqnetMessageId.PARAM_SET_PERCENT, dest, payload, seqNum)
}

/**
 * MultiParamSubscribe (0x010F) — subscribe to real-time updates for a parameter.
 * Payload: [paramCount (1B)] + [paramId (2B)] × paramCount
 */
export function buildMultiParamSubscribe(dest: HiqnetAddress, paramIds: number[], seqNum: number): Buffer {
	const payload = Buffer.alloc(1 + paramIds.length * 2)
	payload.writeUInt8(paramIds.length, 0)
	for (let i = 0; i < paramIds.length; i++) {
		payload.writeUInt16BE(paramIds[i], 1 + i * 2)
	}
	return buildMessage(HiqnetMessageId.MULTI_PARAM_SUBSCRIBE, dest, payload, seqNum)
}

/**
 * Recall (0x0125) — trigger snapshot/scene recall on the device.
 * The destination address determines which snapshot bank is recalled.
 * No extra payload needed beyond the target address.
 */
export function buildRecall(dest: HiqnetAddress, seqNum: number): Buffer {
	return buildMessage(HiqnetMessageId.RECALL, dest, Buffer.alloc(0), seqNum)
}

// ─── Response parsing ─────────────────────────────────────────────────────────

export interface ParsedParamValue {
	paramId: number
	dataType: number
	/** Numeric value — byte, word, or scaled percent */
	value: number
}

/**
 * Parse the payload of a MultiParamGet response or subscription update.
 * Returns an array of param values.
 */
export function parseMultiParamResponse(payload: Buffer): ParsedParamValue[] {
	if (payload.length < 1) return []
	const count = payload.readUInt8(0)
	const results: ParsedParamValue[] = []
	let offset = 1

	for (let i = 0; i < count; i++) {
		if (offset + 3 > payload.length) break
		const paramId = payload.readUInt16BE(offset)
		const dataType = payload.readUInt8(offset + 2)
		offset += 3

		let value = 0
		switch (dataType) {
			case HiqnetDataType.BYTE:
				value = payload.readUInt8(offset)
				offset += 1
				break
			case HiqnetDataType.WORD:
				value = payload.readInt16BE(offset)
				offset += 2
				break
			case HiqnetDataType.UWORD:
				value = payload.readUInt16BE(offset)
				offset += 2
				break
			case HiqnetDataType.LONG:
				value = payload.readInt32BE(offset)
				offset += 4
				break
			case HiqnetDataType.FLOAT:
				value = payload.readFloatBE(offset)
				offset += 4
				break
			default:
				// Unknown type — stop parsing
				return results
		}
		results.push({ paramId, dataType, value })
	}
	return results
}

/**
 * Parse a ParamSetPercent response payload (raw UWORD → 0.0–100.0 percent).
 */
export function parseParamPercentResponse(payload: Buffer): ParsedParamValue[] {
	if (payload.length < 1) return []
	const count = payload.readUInt8(0)
	const results: ParsedParamValue[] = []
	let offset = 1
	for (let i = 0; i < count; i++) {
		if (offset + 4 > payload.length) break
		const paramId = payload.readUInt16BE(offset)
		const raw = payload.readUInt16BE(offset + 2)
		results.push({ paramId, dataType: HiqnetDataType.UWORD, value: raw / 655.35 })
		offset += 4
	}
	return results
}
