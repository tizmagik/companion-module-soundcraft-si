import type { CompanionActionDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import {
	inputChannelObject,
	auxObject,
	SiImpactObjects,
	INPUT_CHANNEL_COUNT,
	AUX_COUNT,
} from './protocol/parameters.js'
import { inputKey, auxKey, MAIN_LR_KEY } from './main.js'

// ─── Dropdown choices ────────────────────────────────────────────────────────

const INPUT_CHANNEL_CHOICES = Array.from({ length: INPUT_CHANNEL_COUNT }, (_, i) => ({
	id: i + 1,
	label: `Input ${i + 1}`,
}))

const AUX_CHOICES = Array.from({ length: AUX_COUNT }, (_, i) => ({
	id: i + 1,
	label: `Aux ${i + 1}`,
}))

const MUTE_STATE_CHOICES = [
	{ id: 'toggle', label: 'Toggle' },
	{ id: 'mute', label: 'Mute' },
	{ id: 'unmute', label: 'Unmute' },
]

// ─── Actions ─────────────────────────────────────────────────────────────────

export function UpdateActions(self: ModuleInstance): void {
	const actions: CompanionActionDefinitions = {
		mute_channel: {
			name: 'Mute / Unmute Input Channel',
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Channel',
					default: 1,
					choices: INPUT_CHANNEL_CHOICES,
				},
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					default: 'toggle',
					choices: MUTE_STATE_CHOICES,
				},
			],
			callback: async (event) => {
				const channel = Number(event.options.channel)
				const obj = inputChannelObject(channel)
				let muted: boolean

				if (event.options.state === 'toggle') {
					muted = !(self.muteState.get(inputKey(channel)) ?? false)
				} else {
					muted = event.options.state === 'mute'
				}

				self.muteState.set(inputKey(channel), muted)
				self.sendMute(obj, muted)
				self.checkFeedbacks('channel_muted')
				self.syncMuteVariables()
			},
		},

		set_fader: {
			name: 'Set Input Fader Level',
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Channel',
					default: 1,
					choices: INPUT_CHANNEL_CHOICES,
				},
				{
					id: 'level',
					type: 'number',
					label: 'Level (%)',
					default: 100,
					min: 0,
					max: 100,
				},
			],
			callback: async (event) => {
				const channel = Number(event.options.channel)
				const level = Number(event.options.level)
				self.faderLevel.set(inputKey(channel), level)
				self.sendFaderLevel(inputChannelObject(channel), level)
				self.syncFaderVariables()
			},
		},

		mute_aux: {
			name: 'Mute / Unmute Aux Mix',
			options: [
				{
					id: 'aux',
					type: 'dropdown',
					label: 'Aux',
					default: 1,
					choices: AUX_CHOICES,
				},
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					default: 'toggle',
					choices: MUTE_STATE_CHOICES,
				},
			],
			callback: async (event) => {
				const aux = Number(event.options.aux)
				const obj = auxObject(aux)
				let muted: boolean

				if (event.options.state === 'toggle') {
					muted = !(self.muteState.get(auxKey(aux)) ?? false)
				} else {
					muted = event.options.state === 'mute'
				}

				self.muteState.set(auxKey(aux), muted)
				self.sendMute(obj, muted)
				self.checkFeedbacks('aux_muted')
				self.syncMuteVariables()
			},
		},

		set_aux_master: {
			name: 'Set Aux Master Level',
			options: [
				{
					id: 'aux',
					type: 'dropdown',
					label: 'Aux',
					default: 1,
					choices: AUX_CHOICES,
				},
				{
					id: 'level',
					type: 'number',
					label: 'Level (%)',
					default: 100,
					min: 0,
					max: 100,
				},
			],
			callback: async (event) => {
				const aux = Number(event.options.aux)
				const level = Number(event.options.level)
				self.faderLevel.set(auxKey(aux), level)
				self.sendFaderLevel(auxObject(aux), level)
				self.syncFaderVariables()
			},
		},

		mute_main: {
			name: 'Mute / Unmute Main LR',
			options: [
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					default: 'toggle',
					choices: MUTE_STATE_CHOICES,
				},
			],
			callback: async (event) => {
				let muted: boolean
				if (event.options.state === 'toggle') {
					muted = !(self.muteState.get(MAIN_LR_KEY) ?? false)
				} else {
					muted = event.options.state === 'mute'
				}
				self.muteState.set(MAIN_LR_KEY, muted)
				self.sendMute(SiImpactObjects.MAIN_LR, muted)
				self.checkFeedbacks('main_muted')
				self.syncMuteVariables()
			},
		},

		set_main_fader: {
			name: 'Set Main LR Fader Level',
			options: [
				{
					id: 'level',
					type: 'number',
					label: 'Level (%)',
					default: 100,
					min: 0,
					max: 100,
				},
			],
			callback: async (event) => {
				const level = Number(event.options.level)
				self.faderLevel.set(MAIN_LR_KEY, level)
				self.sendFaderLevel(SiImpactObjects.MAIN_LR, level)
				self.syncFaderVariables()
			},
		},

		recall_snapshot: {
			name: 'Recall Snapshot',
			options: [
				{
					id: 'index',
					type: 'number',
					label: 'Snapshot Number',
					tooltip: 'Snapshot index on the mixer (1-based). Exact addressing must be confirmed with Audio Architect.',
					default: 1,
					min: 1,
					max: 500,
				},
			],
			callback: async (event) => {
				const index = Number(event.options.index)
				// TODO: confirm snapshot object addressing with Audio Architect
				const snapshotObject: [number, number, number] = [0x00, 0x04, index]
				self.sendRecall(snapshotObject)
			},
		},

		poll_now: {
			name: 'Poll All Parameters Now',
			options: [],
			callback: async () => {
				self.pollParameters()
			},
		},
	}

	self.setActionDefinitions(actions)
}
