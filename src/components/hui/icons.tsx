import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function base({ size = 22, ...rest }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
    ...rest,
  };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 10.8 12 4.2l8 6.6V19a1.4 1.4 0 0 1-1.4 1.4H15v-5.6H9v5.6H5.4A1.4 1.4 0 0 1 4 19v-8.2Z" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="4" />
      <path d="M8 3.8v3.4M16 3.8v3.4M4.4 10.2h15.2" />
    </svg>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8.5" r="3.1" />
      <circle cx="17.2" cy="9.6" r="2.4" />
      <path d="M3.2 19.5c.4-3.2 2.9-5 5.8-5s5.4 1.8 5.8 5" />
      <path d="M15.2 15c2.4-.5 5 .9 5.6 4" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.2 16.5V11a5.8 5.8 0 0 1 11.6 0v5.5l1.6 2H4.6l1.6-2Z" />
      <path d="M10 20.8a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8.4" r="3.9" />
      <path d="M4.6 20c.5-3.7 3.5-6 7.4-6s6.9 2.3 7.4 6" />
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21s6.8-5.9 6.8-11.2a6.8 6.8 0 1 0-13.6 0C5.2 15.1 12 21 12 21Z" />
      <circle cx="12" cy="9.6" r="2.4" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.6V12l3 1.9" />
    </svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 19c0-8.2 5.6-13.4 14-14 .4 8.6-4.8 14.2-13 14" />
      <path d="M5 19c2.4-3.6 5.4-6.2 9-8" />
    </svg>
  );
}

export function BowlIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.6 11.4h16.8c0 4.4-3.5 7.6-8.4 7.6s-8.4-3.2-8.4-7.6Z" />
      <path d="M9 8.2c-.8-1 .8-1.8 0-2.8M13 8.2c-.8-1 .8-1.8 0-2.8M16.6 8.2c-.7-.9.6-1.6 0-2.4" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19 12H5.5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5.2v13.6M5.2 12h13.6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5.2 12.6 4.4 4.4 9.2-9.8" />
    </svg>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9.2 9.4a2.9 2.9 0 1 1 4.4 2.5c-.9.6-1.6 1.1-1.6 2.2" />
      <circle cx="12" cy="17.6" r=".6" fill="currentColor" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 3.2v2M12 18.8v2M3.2 12h2M18.8 12h2M5.8 5.8l1.4 1.4M16.8 16.8l1.4 1.4M18.2 5.8l-1.4 1.4M7.2 16.8l-1.4 1.4" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2Z" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.6c.6 3.8 1.8 5 5.6 5.6-3.8.6-5 1.8-5.6 5.6-.6-3.8-1.8-5-5.6-5.6 3.8-.6 5-1.8 5.6-5.6ZM18 15.6c.3 1.8.8 2.3 2.6 2.6-1.8.3-2.3.8-2.6 2.6-.3-1.8-.8-2.3-2.6-2.6 1.8-.3 2.3-.8 2.6-2.6Z" />
    </svg>
  );
}
