import { combineRgb, type CompanionFeedbackDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { inputKey, auxKey, MAIN_LR_KEY } from './main.js'
import { INPUT_CHANNEL_COUNT, AUX_COUNT } from './protocol/parameters.js'

const INPUT_CHANNEL_CHOICES = Array.from({ length: INPUT_CHANNEL_COUNT }, (_, i) => ({
	id: i + 1,
	label: `Input ${i + 1}`,
}))

const AUX_CHOICES = Array.from({ length: AUX_COUNT }, (_, i) => ({
	id: i + 1,
	label: `Aux ${i + 1}`,
}))

const MUTED_STYLE = {
	bgcolor: combineRgb(200, 0, 0),
	color: combineRgb(255, 255, 255),
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions = {
		channel_muted: {
			name: 'Input Channel Muted',
			type: 'boolean',
			defaultStyle: MUTED_STYLE,
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Channel',
					default: 1,
					choices: INPUT_CHANNEL_CHOICES,
				},
			],
			callback: (feedback) => {
				const channel = Number(feedback.options.channel)
				return self.muteState.get(inputKey(channel)) ?? false
			},
		},

		aux_muted: {
			name: 'Aux Mix Muted',
			type: 'boolean',
			defaultStyle: MUTED_STYLE,
			options: [
				{
					id: 'aux',
					type: 'dropdown',
					label: 'Aux',
					default: 1,
					choices: AUX_CHOICES,
				},
			],
			callback: (feedback) => {
				const aux = Number(feedback.options.aux)
				return self.muteState.get(auxKey(aux)) ?? false
			},
		},

		main_muted: {
			name: 'Main LR Muted',
			type: 'boolean',
			defaultStyle: MUTED_STYLE,
			options: [],
			callback: () => {
				return self.muteState.get(MAIN_LR_KEY) ?? false
			},
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
