// HiQNet protocol constants — ported from Harman Third-Party Programmer's Guide

export const HIQNET_PORT = 3804
export const HIQNET_VERSION = 2
export const HIQNET_HEADER_LEN = 25 // bytes, without optional session number
export const HIQNET_HEADER_LEN_WITH_SESSION = 27
export const HIQNET_KEEP_ALIVE_INTERVAL_MS = 8_000

// "Anonymous" controller source address — used when we have no assigned device address
export const SOURCE_DEVICE_ADDRESS = 0x7ffe
export const SOURCE_VIRTUAL_DEVICE = 0x00
export const SOURCE_OBJECT: [number, number, number] = [0x00, 0x00, 0x00]

// Broadcast destination address
export const BROADCAST_DEVICE_ADDRESS = 0xffff
export const BROADCAST_VIRTUAL_DEVICE = 0x01
export const BROADCAST_OBJECT: [number, number, number] = [0x00, 0x00, 0x00]

// Message IDs (2 bytes, big-endian)
export const HiqnetMessageId = {
	// Routing-layer messages
	DISCO_INFO: 0x0000,
	GET_NETWORK_INFO: 0x0002,
	REQUEST_ADDRESS: 0x0004,
	ADDRESS_USED: 0x0005,
	SET_ADDRESS: 0x0006,
	GOODBYE: 0x0007,
	HELLO: 0x0008,

	// Device-level messages
	GET_ATTRIBUTES: 0x010d,
	MULTI_PARAM_SET: 0x0100,
	MULTI_OBJECT_PARAM_SET: 0x0101,
	PARAM_SET_PERCENT: 0x0102,
	MULTI_PARAM_GET: 0x0103,
	MULTI_PARAM_SUBSCRIBE: 0x010f,
	PARAM_SUBSCRIBE_PERCENT: 0x0111,
	MULTI_PARAM_UNSUBSCRIBE: 0x0112,
	PARAM_SUBSCRIBE_ALL: 0x0113,
	EVENT_LOG_SUBSCRIBE: 0x0115,
	GET_VD_LIST: 0x011a,
	EVENT_LOG_UNSUBSCRIBE: 0x012b,
	EVENT_LOG_REQUEST: 0x012c,
	STORE: 0x0124,
	RECALL: 0x0125,
	LOCATE: 0x0129,
} as const

export type HiqnetMessageId = (typeof HiqnetMessageId)[keyof typeof HiqnetMessageId]

// Flags bitmask positions (in a 16-bit flags word)
export const HiqnetFlags = {
	REQ_ACK: 0x0001,
	ACK: 0x0002,
	INFORMATION: 0x0004,
	ERROR: 0x0008,
	GUARANTEED: 0x0010,
	MULTIPART: 0x0020,
	SESSION_NUMBER: 0x0040,
} as const

// Parameter data types used in MultiParamSet payloads
export const HiqnetDataType = {
	BYTE: 0x02, // 1 byte unsigned
	WORD: 0x03, // 2 bytes signed
	LONG: 0x04, // 4 bytes signed
	FLOAT: 0x05, // 4 bytes IEEE 754
	STRING: 0x06, // variable length, null-terminated
	UWORD: 0x07, // 2 bytes unsigned (0–65535)
} as const
