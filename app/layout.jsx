import './globals.css';

export const metadata = {
  title: 'Уралмаш ГОО',
  description: 'Сайт Уралмаш ГОО — горно-обогатительное оборудование',
};

export default function RootLayout({ children }) {
  return <html lang="ru"><body>{children}</body></html>;
}
