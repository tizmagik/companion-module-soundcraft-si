import { combineRgb, type CompanionPresetDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { INPUT_CHANNEL_COUNT, AUX_COUNT } from './protocol/parameters.js'

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

	// Input channel mute buttons
	for (let ch = 1; ch <= INPUT_CHANNEL_COUNT; ch++) {
		presets[`mute_ch_${ch}`] = {
			type: 'button',
			category: 'Input Mutes',
			name: `Mute Ch ${ch}`,
			style: {
				text: `CH ${ch}\\nMUTE`,
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [{ actionId: 'mute_channel', options: { channel: ch, state: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'channel_muted',
					options: { channel: ch },
					style: {
						bgcolor: combineRgb(200, 0, 0),
						color: combineRgb(255, 255, 255),
					},
				},
			],
		}
	}

	// Aux mute buttons
	for (let a = 1; a <= AUX_COUNT; a++) {
		presets[`mute_aux_${a}`] = {
			type: 'button',
			category: 'Aux Mutes',
			name: `Mute Aux ${a}`,
			style: {
				text: `AUX ${a}\\nMUTE`,
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [{ actionId: 'mute_aux', options: { aux: a, state: 'toggle' } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'aux_muted',
					options: { aux: a },
					style: {
						bgcolor: combineRgb(200, 0, 0),
						color: combineRgb(255, 255, 255),
					},
				},
			],
		}
	}

	// Main LR mute button
	presets['mute_main'] = {
		type: 'button',
		category: 'Main',
		name: 'Mute Main LR',
		style: {
			text: 'MAIN\\nMUTE',
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [
			{
				down: [{ actionId: 'mute_main', options: { state: 'toggle' } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'main_muted',
				options: {},
				style: {
					bgcolor: combineRgb(200, 0, 0),
					color: combineRgb(255, 255, 255),
				},
			},
		],
	}

	self.setPresetDefinitions(presets)
}
