import './globals.css';
import { PortalProvider } from '@/components/providers/portal-provider';
import PortalShell from '@/components/layout/portal-shell';
export const metadata = { title: { default: 'Jharkhand Innovation | Together, for a better tomorrow', template: '%s | Jharkhand Innovation' }, description: 'Report a problem. Connect expertise. Build a solution. A collaborative innovation portal connecting citizens, universities and partners across Jharkhand.' };
export default function RootLayout({ children }) { return <html lang="en"><body><PortalProvider><PortalShell>{children}</PortalShell></PortalProvider></body></html>; }
