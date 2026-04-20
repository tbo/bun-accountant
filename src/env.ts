export const requireEnv = (key: string): string => {
	const value = process.env[key];
	if (value === undefined) throw new Error(`Missing env var: ${key}`);
	return value;
};
