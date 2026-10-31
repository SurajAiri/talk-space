import type { ReactNode, SVGProps } from 'react'

/** Small stroke icon set (24px grid, 1.75 stroke). Decorative by default: pair with a text label or aria-label on the button. */
function Icon({ children, size = 18, ...rest }: SVGProps<SVGSVGElement> & { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

type P = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

export const MicIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <path d="M12 19v3" />
  </Icon>
)
export const MicOffIcon = (p: P) => (
  <Icon {...p}>
    <path d="m2 2 20 20" />
    <path d="M18.9 13.2A7 7 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.3V5a3 3 0 0 0-5.7-1.3" />
    <path d="M9 9v3a3 3 0 0 0 5.1 2.1" />
    <path d="M12 19v3" />
  </Icon>
)
export const HeadphonesIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
  </Icon>
)
export const LogOutIcon = (p: P) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Icon>
)
export const PhoneOffIcon = (p: P) => (
  <Icon {...p}>
    <path d="M10.7 13.3a16 16 0 0 1-2.9-3.9l1.6-1.6a1.6 1.6 0 0 0 .4-1.6L9 3.5A1.6 1.6 0 0 0 7.4 2.4H4.6A2.2 2.2 0 0 0 2.4 4.8 19.5 19.5 0 0 0 19.2 21.6a2.2 2.2 0 0 0 2.4-2.2v-2.8a1.6 1.6 0 0 0-1.1-1.6l-3.7-.6a1.6 1.6 0 0 0-1.6.4l-1.6 1.6" />
    <path d="m2 2 20 20" />
  </Icon>
)
export const CopyIcon = (p: P) => (
  <Icon {...p}>
    <rect width="13" height="13" x="9" y="9" rx="2" />
    <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" />
  </Icon>
)
export const CheckIcon = (p: P) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)
export const SearchIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
)
export const PlusIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
export const LockIcon = (p: P) => (
  <Icon {...p}>
    <rect width="16" height="10" x="4" y="11" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
)
export const UsersIcon = (p: P) => (
  <Icon {...p}>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
    <circle cx="9.5" cy="7.5" r="3.5" />
    <path d="M21 20v-1.5a4 4 0 0 0-3-3.9M15.5 4.2a3.5 3.5 0 0 1 0 6.6" />
  </Icon>
)
export const GlobeIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </Icon>
)
export const ShieldIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6l-7-3Z" />
  </Icon>
)
export const VolumeIcon = (p: P) => (
  <Icon {...p}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
    <path d="M15.5 8.500a5 5 0 0 1 0 7M18.5 5.500a9 9 0 0 1 0 13" />
  </Icon>
)
export const XIcon = (p: P) => (
  <Icon {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
)
export const BanIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.7 5.7 12.6 12.6" />
  </Icon>
)
export const FlagIcon = (p: P) => (
  <Icon {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h11l-1.5 4 1.5 4H5" />
  </Icon>
)
export const SendIcon = (p: P) => (
  <Icon {...p}>
    <path d="M21 3 10 14" />
    <path d="m21 3-7 18-4-7-7-4 18-7Z" />
  </Icon>
)
export const UserIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </Icon>
)
export const ChevronLeftIcon = (p: P) => (
  <Icon {...p}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
)
export const MapIcon = (p: P) => (
  <Icon {...p}>
    <path d="M9 4 3 6.5V20l6-2.500 6 2.500 6-2.500V4l-6 2.500L9 4Z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </Icon>
)
export const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.200H12v4.200h5.900a5 5 0 0 1-2.200 3.300v2.700h3.5c2.100-1.900 3.300-4.700 3.300-8Z" />
    <path fill="#34A853" d="M12 23c3 0 5.500-1 7.300-2.700l-3.5-2.700c-1 .7-2.200 1.100-3.800 1.100-2.900 0-5.400-2-6.300-4.600H2.100v2.800A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.7 13.900a6.600 6.600 0 0 1 0-4.200V6.900H2.100a11 11 0 0 0 0 10l3.600-3Z" />
    <path fill="#EA4335" d="M12 5.400c1.600 0 3.100.6 4.200 1.600l3.100-3.100A11 11 0 0 0 2.100 6.900l3.600 2.800C6.600 7.300 9.100 5.400 12 5.400Z" />
  </svg>
)
