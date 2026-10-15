// Local SVG icons keep the app usable without an icon CDN or extra package.
const paths = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  bag: (
    <>
      <path d="M5 7h14l1 14H4L5 7Z" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
    </>
  ),
  store: (
    <>
      <path d="M3 10h18l-2-6H5l-2 6ZM5 10v11h14V10M9 21v-7h6v7" />
      <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
    </>
  ),
  truck: (
    <>
      <path d="M2 5h12v12H2ZM14 9h4l4 5v3h-8" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="18" r="3" />
    </>
  ),
  chef: (
    <>
      <path d="M7 15v6h10v-6a5 5 0 0 0 1-10 6 6 0 0 0-12 0 5 5 0 0 0 1 10ZM7 17h10" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-3a7 7 0 0 1 14 0v3M17 3a4 4 0 0 1 0 8M19 14a7 7 0 0 1 3 6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 3v18h17M8 16v-5M13 16V6M18 16v-8" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  logout: (
    <>
      <path d="M9 3H4v18h5M10 12h12m-5-5 5 5-5 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 4 4L20 5" />,
  leaf: (
    <>
      <path d="M20 3S3 1 3 13a8 8 0 0 0 14 5c4-5 3-15 3-15ZM4 20 16 8" />
    </>
  ),
};
export default function Icon({ name = "grid", size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.grid}
    </svg>
  );
}
