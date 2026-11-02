import { Dancing_Script, Nunito } from 'next/font/google';
import './globals.css';

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-dancing',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-nunito',
});

export const metadata = {
  title: 'Lizdy Pineda Fotoestudio',
  description: 'Sistema de gestión – Lizdy Pineda Fotoestudio',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${dancingScript.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
