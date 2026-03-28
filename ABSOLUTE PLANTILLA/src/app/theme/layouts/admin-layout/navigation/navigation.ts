export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  groupClasses?: string;
  exactMatch?: boolean;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  children?: NavigationItem[];
  link?: string;
  description?: string;
  path?: string;
}

export const NavigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'default',
        title: 'Control Panel',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/default',
        icon: 'dashboard',
        breadcrumbs: false
      }
    ]
  },
  {
    id: 'server',
    title: 'Minecraft',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'server-collapse',
        title: 'Server Control',
        type: 'collapse',
        icon: 'code',
        children: [
          {
            id: 'console',
            title: 'Console',
            type: 'item',
            url: '/server/console'
          },
          {
            id: 'settings',
            title: 'Server Settings',
            type: 'item',
            url: '/server/settings'
          }
        ]
      },
      {
        id: 'file-manager',
        title: 'File Manager',
        type: 'item',
        classes: 'nav-item',
        url: '/server/files',
        icon: 'file-text'
      },
      {
        id: 'whitelist',
        title: 'Whitelist',
        type: 'item',
        classes: 'nav-item',
        url: '/server/whitelist',
        icon: 'user'
      },
      {
        id: 'backups',
        title: 'Backups',
        type: 'item',
        classes: 'nav-item',
        url: '/server/backups',
        icon: 'database'
      },
      {
        id: 'mods',
        title: 'Mods Manager',
        type: 'item',
        classes: 'nav-item',
        url: '/server/mods',
        icon: 'deployment-unit'
      }
    ]
  },
  {
    id: 'music-studio',
    title: 'Estudio Musical',
    type: 'group',
    icon: 'customer-service',
    children: [
      {
        id: 'studio',
        title: 'PRO DAW Studio',
        type: 'item',
        classes: 'nav-item',
        url: '/music/studio',
        icon: 'customer-service'
      },
      {
        id: 'theory',
        title: 'Music Brain (IA)',
        type: 'item',
        classes: 'nav-item',
        url: '/music/theory',
        icon: 'bulb'
      }
    ]
  }
];
