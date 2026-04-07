import { Regex, type SomeCompanionConfigField } from '@companion-module/base'
import { HIQNET_PORT } from './protocol/constants.js'

export interface ModuleConfig {
	host: string
	port: number
	deviceAddress: number
	pollIntervalMs: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Mixer IP Address',
			width: 8,
			regex: Regex.IP,
		},
		{
			type: 'number',
			id: 'port',
			label: 'Port',
			width: 4,
			min: 1,
			max: 65535,
			default: HIQNET_PORT,
		},
		{
			type: 'number',
			id: 'deviceAddress',
			label: 'HiQnet Device Address (decimal)',
			tooltip:
				'The HiQnet device address assigned to the mixer. ' +
				'Find it in HiQnet Audio Architect or leave as default (1337 = 0x0539).',
			width: 6,
			min: 1,
			max: 65534,
			default: 1337,
		},
		{
			type: 'number',
			id: 'pollIntervalMs',
			label: 'Poll Interval (ms, 0 = off)',
			tooltip: 'How often to request parameter values from the mixer. Set to 0 to disable polling.',
			width: 6,
			min: 0,
			max: 60000,
			default: 2000,
		},
	]
}
