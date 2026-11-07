import SocialLinksStyles from './SocialLinks.module.css';
import { safeSocialUrl } from '../../lib/social-links.mjs';

type SocialPayload = { max?: string; vk?: string; telegram?: string };

export default function SocialLinks({ contacts }: { contacts: { payload?: SocialPayload }[] }) {
  const networks = [
    { key: 'max' as const, label: 'MAX', viewBox: '0 0 720 720', icon: <path d="M350.4,9.6C141.8,20.5,4.1,184.1,12.8,390.4c3.8,90.3,40.1,168,48.7,253.7,2.2,22.2-4.2,49.6,21.4,59.3,31.5,11.9,79.8-8.1,106.2-26.4,9-6.1,17.6-13.2,24.2-22,27.3,18.1,53.2,35.6,85.7,43.4,143.1,34.3,299.9-44.2,369.6-170.3C799.6,291.2,622.5-4.6,350.4,9.6h0ZM269.4,504c-11.3,8.8-22.2,20.8-34.7,27.7-18.1,9.7-23.7-.4-30.5-16.4-21.4-50.9-24-137.6-11.5-190.9,16.8-72.5,72.9-136.3,150-143.1,78-6.9,150.4,32.7,183.1,104.2,72.4,159.1-112.9,316.2-256.4,218.6h0Z" /> },
    { key: 'vk' as const, label: 'ВКонтакте', viewBox: '0 0 24 24', icon: null },
    { key: 'telegram' as const, label: 'Telegram', viewBox: '0 0 24 24', icon: <path d="M20.8 4.4 3.5 11.1c-1.2.5-1.2 1.2-.2 1.5l4.4 1.4 1.7 5.2c.2.6.1.9.8.9.5 0 .7-.2.9-.4l2.1-2 4.4 3.2c.8.4 1.4.2 1.6-.8L22 5.7c.3-1.2-.5-1.8-1.2-1.3ZM9.4 13.7l9.8-6.2c.5-.3.9-.1.6.2l-8.1 7.3-.3 3.3z" /> },
  ];

  return (
    <div className={"social-links" + " " + SocialLinksStyles["social-links"]} aria-label="Социальные сети и мессенджеры">
      {networks.map(({ key, label, viewBox, icon }) => {
        const href = contacts.map((contact) => safeSocialUrl(contact.payload?.[key])).find(Boolean);
        const content = key === 'vk'
          ? <span className={SocialLinksStyles["social-links__vk-icon"]} aria-hidden="true" />
          : <svg viewBox={viewBox} aria-hidden="true" fill="currentColor">{icon}</svg>;
        return href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>{content}</a>
        ) : (
          <span key={key} className={SocialLinksStyles["social-links__disabled"]} aria-label={`${label}: ссылка не указана`} title={`${label}: ссылка не указана`}>{content}</span>
        );
      })}
    </div>
  );
}
