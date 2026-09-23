import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
export const buttonVariants = cva('btn', { variants: { variant: { default: 'btn-primary', secondary: 'btn-secondary', outline: 'btn-secondary', ghost: 'btn-ghost', destructive: 'btn-danger' }, size: { default: '', sm: 'btn-sm', icon: 'btn-icon' } }, defaultVariants: { variant: 'default', size: 'default' } });
export function Button({ className, variant, size, asChild = false, ...props }) { const Component = asChild ? Slot : 'button'; return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />; }
