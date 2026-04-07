import type { CompanionVariableDefinition } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { INPUT_CHANNEL_COUNT, AUX_COUNT } from './protocol/parameters.js'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const variables: CompanionVariableDefinition[] = [
		{ variableId: 'connection_status', name: 'Connection Status' },
		{ variableId: 'main_fader', name: 'Main LR Fader Level' },
		{ variableId: 'main_mute', name: 'Main LR Mute State' },
	]

	for (let ch = 1; ch <= INPUT_CHANNEL_COUNT; ch++) {
		variables.push({ variableId: `input_${ch}_mute`, name: `Input ${ch} Mute State` })
		variables.push({ variableId: `input_${ch}_fader`, name: `Input ${ch} Fader Level` })
	}

	for (let a = 1; a <= AUX_COUNT; a++) {
		variables.push({ variableId: `aux_${a}_mute`, name: `Aux ${a} Mute State` })
		variables.push({ variableId: `aux_${a}_level`, name: `Aux ${a} Level` })
	}

	self.setVariableDefinitions(variables)
}

export function initVariableValues(self: ModuleInstance): void {
	const values: Record<string, string> = {
		connection_status: 'Disconnected',
		main_fader: '0%',
		main_mute: 'Unmuted',
	}
	for (let ch = 1; ch <= INPUT_CHANNEL_COUNT; ch++) {
		values[`input_${ch}_mute`] = 'Unmuted'
		values[`input_${ch}_fader`] = '0%'
	}
	for (let a = 1; a <= AUX_COUNT; a++) {
		values[`aux_${a}_mute`] = 'Unmuted'
		values[`aux_${a}_level`] = '0%'
	}
	self.setVariableValues(values)
}
