import { v4 as uuidv4 } from 'uuid';

const firstNames = [
	'Mighty',
	'Swift',
	'Brave',
	'Clever',
	'Gentle',
	'Happy',
	'Wise',
	'Bold',
	'Cheerful',
	'Playful'
];
const lastNames = [
	'Panda',
	'Falcon',
	'Tiger',
	'Fox',
	'Dolphin',
	'Koala',
	'Owl',
	'Lion',
	'Penguin',
	'Otter'
];

export function generateRandomUser() {
	const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
	const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
	const randomName = `${randomFirstName} ${randomLastName}`;
	const randomProfilePicture = `https://api.dicebear.com/6.x/identicon/svg?seed=${uuidv4()}`;
	const id = uuidv4();
	const streak = 0;
	const inventory: Record<string, number> = {}; // Initialize empty inventory

	return { name: randomName, profilePicture: randomProfilePicture, streak, inventory, id };
}

export function getUserFromCookie(cookieString: string): Record<string, unknown> | null {
	const userCookie = cookieString.split('; ').find((row: string) => row.startsWith('user='));

	if (userCookie) {
		return JSON.parse(decodeURIComponent(userCookie.split('=')[1])) as Record<string, unknown>;
	}

	return null;
}

export function saveUserToCookie(user: Record<string, unknown>, setCookie: (cookie: string) => void): void {
	setCookie(`user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=31536000`);
}

export function addToInventory(user: { inventory: Record<string, number> }, componentName: string, quantity: number, setCookie: (cookie: string) => void) {
	user.inventory[componentName] = (user.inventory[componentName] || 0) + quantity;
	saveUserToCookie(user, setCookie);
}

export function removeFromInventory(user: { inventory: Record<string, number> }, componentName: string, quantity: number, setCookie: (cookie: string) => void) {
	if (user.inventory[componentName]) {
		user.inventory[componentName] = Math.max(0, user.inventory[componentName] - quantity);
		saveUserToCookie(user, setCookie);
	}
}

export function getInventory(user: { inventory: Record<string, number> }) {
	return user.inventory;
}