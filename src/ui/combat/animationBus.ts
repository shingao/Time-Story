type Listener = (data?: unknown) => void;
const _channels = new Map<string, Set<Listener>>();

/** Singleton event bus for animation side-effects.
 *  AnimationDriver emits; visual components subscribe in useEffect.
 */
export const animationBus = {
	on(channel: string, fn: Listener): () => void {
		let set = _channels.get(channel);
		if (!set) {
			set = new Set();
			_channels.set(channel, set);
		}
		set.add(fn);
		return () => {
			_channels.get(channel)?.delete(fn);
		};
	},

	emit(channel: string, data?: unknown): void {
		_channels.get(channel)?.forEach((fn) => {
			fn(data);
		});
	},
};
