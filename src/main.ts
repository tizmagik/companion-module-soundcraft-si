import { InstanceBase, runEntrypoint, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, initVariableValues } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { HiqnetConnection } from './connection/HiqnetConnection.js'
import {
	buildMultiParamGet,
	buildMultiParamSetByte,
	buildParamSetPercent,
	buildRecall,
	parseMultiParamResponse,
	parseParamPercentResponse,
	type HiqnetHeader,
} from './protocol/message.js'
import { HiqnetMessageId, HIQNET_PORT } from './protocol/constants.js'
import {
	SiImpactParamId,
	inputChannelObject,
	auxObject,
	SiImpactObjects,
	SI_IMPACT_VIRTUAL_DEVICE,
	INPUT_CHANNEL_COUNT,
	AUX_COUNT,
} from './protocol/parameters.js'

// State key helpers — used to key into muteState and faderLevel maps
export function inputKey(channel: number): string {
	return `input:${channel}`
}
export function auxKey(aux: number): string {
	return `aux:${aux}`
}
export const MAIN_LR_KEY = 'main:lr'
export const MONO_KEY = 'main:mono'

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig
	connection: HiqnetConnection | null = null

	// Cached mixer state — updated by poll responses and subscriptions
	muteState: Map<string, boolean> = new Map()
	faderLevel: Map<string, number> = new Map() // 0.0–100.0 percent

	private pollTimer: ReturnType<typeof setInterval> | null = null

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.updateStatus(InstanceStatus.Disconnected)

		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		initVariableValues(this)

		this.setupConnection()
	}

	async destroy(): Promise<void> {
		this.stopPolling()
		this.connection?.disconnect()
		this.connection = null
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		const hostChanged = config.host !== this.config.host || config.port !== this.config.port
		this.config = config

		if (hostChanged) {
			this.stopPolling()
			this.connection?.disconnect()
			this.connection = null
			this.setupConnection()
		} else {
			// Poll interval may have changed
			this.startPolling()
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	// ─── HiQnet action helpers (called from actions.ts) ─────────────────────────

	sendMute(dest: ReturnType<typeof inputChannelObject>, muted: boolean): void {
		if (!this.connection) return
		const msg = buildMultiParamSetByte(
			{ deviceNumber: this.config.deviceAddress, virtualDevice: SI_IMPACT_VIRTUAL_DEVICE, object: dest },
			SiImpactParamId.MUTE,
			muted ? 0x01 : 0x00,
			this.connection.nextSeqNum(),
		)
		void this.connection.send(msg)
	}

	sendFaderLevel(dest: ReturnType<typeof inputChannelObject>, percent: number): void {
		if (!this.connection) return
		const msg = buildParamSetPercent(
			{ deviceNumber: this.config.deviceAddress, virtualDevice: SI_IMPACT_VIRTUAL_DEVICE, object: dest },
			SiImpactParamId.FADER_LEVEL,
			percent,
			this.connection.nextSeqNum(),
		)
		void this.connection.send(msg)
	}

	sendRecall(snapshotObject: [number, number, number]): void {
		if (!this.connection) return
		const msg = buildRecall(
			{ deviceNumber: this.config.deviceAddress, virtualDevice: SI_IMPACT_VIRTUAL_DEVICE, object: snapshotObject },
			this.connection.nextSeqNum(),
		)
		void this.connection.send(msg)
	}

	// ─── Private ─────────────────────────────────────────────────────────────────

	private setupConnection(): void {
		const host = this.config.host
		const port = this.config.port ?? HIQNET_PORT
		if (!host) return

		this.connection = new HiqnetConnection(host, port)

		this.connection.on('status', (status, message) => {
			this.updateStatus(status, message)
		})

		this.connection.on('connected', () => {
			this.log('info', `Connected to ${host}:${port}`)
			this.updateStatus(InstanceStatus.Ok)
			this.setVariableValues({ connection_status: 'Connected' })
			this.startPolling()
			// Immediately poll all tracked parameters
			this.pollParameters()
		})

		this.connection.on('disconnected', () => {
			this.log('info', 'Disconnected')
			this.updateStatus(InstanceStatus.Disconnected)
			this.setVariableValues({ connection_status: 'Disconnected' })
			this.stopPolling()
		})

		this.connection.on('message', (header: HiqnetHeader, payload: Buffer) => {
			this.onMessage(header, payload)
		})

		this.connection.connect()
	}

	private onMessage(header: HiqnetHeader, payload: Buffer): void {
		switch (header.messageId) {
			case HiqnetMessageId.MULTI_PARAM_GET:
			case HiqnetMessageId.MULTI_PARAM_SUBSCRIBE: {
				const values = parseMultiParamResponse(payload)
				this.applyParamValues(header.source, values)
				break
			}
			case HiqnetMessageId.PARAM_SET_PERCENT:
			case HiqnetMessageId.PARAM_SUBSCRIBE_PERCENT: {
				const values = parseParamPercentResponse(payload)
				this.applyParamPercentValues(header.source, values)
				break
			}
			default:
				break
		}
	}

	private applyParamValues(source: HiqnetHeader['source'], values: ReturnType<typeof parseMultiParamResponse>): void {
		let stateChanged = false
		for (const { paramId, value } of values) {
			if (paramId === SiImpactParamId.MUTE) {
				const key = this.addressToKey(source)
				if (key) {
					this.muteState.set(key, value !== 0)
					stateChanged = true
				}
			}
		}
		if (stateChanged) {
			this.checkFeedbacks('channel_muted', 'aux_muted', 'main_muted')
			this.syncMuteVariables()
		}
	}

	private applyParamPercentValues(
		source: HiqnetHeader['source'],
		values: ReturnType<typeof parseParamPercentResponse>,
	): void {
		let stateChanged = false
		for (const { paramId, value } of values) {
			if (paramId === SiImpactParamId.FADER_LEVEL) {
				const key = this.addressToKey(source)
				if (key) {
					this.faderLevel.set(key, value)
					stateChanged = true
				}
			}
		}
		if (stateChanged) {
			this.syncFaderVariables()
		}
	}

	private addressToKey(address: HiqnetHeader['source']): string | null {
		// Map object address back to a state key — inverse of parameter addressing
		// TODO: confirm exact object addressing with Audio Architect
		const [, , ch] = address.object
		// Heuristic: if object byte 1 is 0x00 → input channel, 0x01 → aux
		if (address.object[1] === 0x00 && ch > 0 && ch <= INPUT_CHANNEL_COUNT) {
			return inputKey(ch)
		}
		if (address.object[1] === 0x01 && ch > 0 && ch <= AUX_COUNT) {
			return auxKey(ch)
		}
		if (address.object[0] === 0x00 && address.object[1] === 0x03) {
			return ch === 0x01 ? MAIN_LR_KEY : MONO_KEY
		}
		return null
	}

	pollParameters(): void {
		if (!this.connection) return
		const seqNum = () => this.connection!.nextSeqNum()
		const devAddr = this.config.deviceAddress
		const vd = SI_IMPACT_VIRTUAL_DEVICE

		// Poll input channel mutes and fader levels
		for (let ch = 1; ch <= INPUT_CHANNEL_COUNT; ch++) {
			const obj = inputChannelObject(ch)
			const dest = { deviceNumber: devAddr, virtualDevice: vd, object: obj }
			void this.connection.send(buildMultiParamGet(dest, [SiImpactParamId.MUTE, SiImpactParamId.FADER_LEVEL], seqNum()))
		}

		// Poll aux mutes and levels
		for (let a = 1; a <= AUX_COUNT; a++) {
			const obj = auxObject(a)
			const dest = { deviceNumber: devAddr, virtualDevice: vd, object: obj }
			void this.connection.send(buildMultiParamGet(dest, [SiImpactParamId.MUTE, SiImpactParamId.FADER_LEVEL], seqNum()))
		}

		// Poll main LR and mono
		for (const obj of [SiImpactObjects.MAIN_LR, SiImpactObjects.MONO_CENTER]) {
			const dest = { deviceNumber: devAddr, virtualDevice: vd, object: obj }
			void this.connection.send(buildMultiParamGet(dest, [SiImpactParamId.MUTE, SiImpactParamId.FADER_LEVEL], seqNum()))
		}
	}

	private startPolling(): void {
		this.stopPolling()
		const interval = this.config.pollIntervalMs ?? 0
		if (interval <= 0) return
		this.pollTimer = setInterval(() => this.pollParameters(), interval)
	}

	private stopPolling(): void {
		if (this.pollTimer !== null) {
			clearInterval(this.pollTimer)
			this.pollTimer = null
		}
	}

	syncMuteVariables(): void {
		const values: Record<string, string> = {}
		for (let ch = 1; ch <= INPUT_CHANNEL_COUNT; ch++) {
			values[`input_${ch}_mute`] = this.muteState.get(inputKey(ch)) ? 'Muted' : 'Unmuted'
		}
		for (let a = 1; a <= AUX_COUNT; a++) {
			values[`aux_${a}_mute`] = this.muteState.get(auxKey(a)) ? 'Muted' : 'Unmuted'
		}
		values['main_mute'] = this.muteState.get(MAIN_LR_KEY) ? 'Muted' : 'Unmuted'
		this.setVariableValues(values)
	}

	syncFaderVariables(): void {
		const values: Record<string, string> = {}
		for (let ch = 1; ch <= INPUT_CHANNEL_COUNT; ch++) {
			const level = this.faderLevel.get(inputKey(ch))
			if (level !== undefined) values[`input_${ch}_fader`] = level.toFixed(1) + '%'
		}
		for (let a = 1; a <= AUX_COUNT; a++) {
			const level = this.faderLevel.get(auxKey(a))
			if (level !== undefined) values[`aux_${a}_level`] = level.toFixed(1) + '%'
		}
		const mainLevel = this.faderLevel.get(MAIN_LR_KEY)
		if (mainLevel !== undefined) values['main_fader'] = mainLevel.toFixed(1) + '%'
		this.setVariableValues(values)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
