import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs) { return twMerge(clsx(inputs)); }
export function formatDate(value) { return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
export function initials(name = '') { return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase(); }
