import { EventEmitter } from 'node:events'
import { TCPHelper, InstanceStatus } from '@companion-module/base'
import { HIQNET_PORT, HIQNET_KEEP_ALIVE_INTERVAL_MS, HIQNET_HEADER_LEN } from '../protocol/constants.js'
import { buildDiscoInfo, decodeHeader, type HiqnetHeader } from '../protocol/message.js'

type HiqnetConnectionEventMap = {
	connected: []
	disconnected: []
	status: [status: InstanceStatus, message?: string]
	message: [header: HiqnetHeader, payload: Buffer]
}

/**
 * Manages a HiQnet TCP connection:
 *   - Wraps TCPHelper for automatic reconnect
 *   - Handles TCP stream framing (length-prefixed messages)
 *   - Sends keep-alive DiscoInfo packets on a timer
 *   - Emits typed events for the module instance to consume
 */
export class HiqnetConnection extends EventEmitter<HiqnetConnectionEventMap> {
	private socket: TCPHelper | null = null
	private receiveBuffer = Buffer.alloc(0)
	private keepAliveTimer: ReturnType<typeof setInterval> | null = null
	private _seqNum = 0
	private readonly host: string
	private readonly port: number

	constructor(host: string, port: number = HIQNET_PORT) {
		super()
		this.host = host
		this.port = port
	}

	connect(): void {
		if (this.socket) {
			this.disconnect()
		}

		this.receiveBuffer = Buffer.alloc(0)
		this.socket = new TCPHelper(this.host, this.port)

		this.socket.on('status_change', (status: InstanceStatus, message?: string) => {
			this.emit('status', status, message)
		})

		this.socket.on('connect', () => {
			this.startKeepAlive()
			this.emit('connected')
		})

		this.socket.on('end', () => {
			this.stopKeepAlive()
			this.emit('disconnected')
		})

		this.socket.on('error', (_err: Error) => {
			this.stopKeepAlive()
		})

		this.socket.on('data', (data: Buffer) => {
			this.onData(data)
		})
	}

	disconnect(): void {
		this.stopKeepAlive()
		if (this.socket) {
			this.socket.destroy()
			this.socket = null
		}
		this.receiveBuffer = Buffer.alloc(0)
	}

	async send(msg: Buffer): Promise<boolean> {
		if (!this.socket) return false
		return this.socket.send(msg)
	}

	nextSeqNum(): number {
		this._seqNum = (this._seqNum + 1) & 0xffff
		return this._seqNum
	}

	// ─── Private ───────────────────────────────────────────────────────────────

	private onData(chunk: Buffer): void {
		this.receiveBuffer = Buffer.concat([this.receiveBuffer, chunk])
		this.extractFrames()
	}

	private extractFrames(): void {
		while (true) {
			// Need at least 6 bytes to read message length (bytes 2–5)
			if (this.receiveBuffer.length < 6) break

			const messageLength = this.receiveBuffer.readUInt32BE(2)

			// Sanity check: messageLength must be at least as long as the minimum header
			if (messageLength < HIQNET_HEADER_LEN) {
				// Corrupt data — discard one byte and retry
				this.receiveBuffer = this.receiveBuffer.subarray(1)
				continue
			}

			// Wait until the full message is in the buffer
			if (this.receiveBuffer.length < messageLength) break

			const frame = this.receiveBuffer.subarray(0, messageLength)
			this.receiveBuffer = this.receiveBuffer.subarray(messageLength)

			try {
				const header = decodeHeader(frame)
				const payload = frame.subarray(header.headerLength)
				this.emit('message', header, payload)
			} catch {
				// Malformed frame — skip it
			}
		}
	}

	private startKeepAlive(): void {
		this.stopKeepAlive()
		this.keepAliveTimer = setInterval(() => {
			const msg = buildDiscoInfo(this.nextSeqNum())
			void this.send(msg)
		}, HIQNET_KEEP_ALIVE_INTERVAL_MS)
	}

	private stopKeepAlive(): void {
		if (this.keepAliveTimer !== null) {
			clearInterval(this.keepAliveTimer)
			this.keepAliveTimer = null
		}
	}
}
