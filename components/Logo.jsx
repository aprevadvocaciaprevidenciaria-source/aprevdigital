// Brasão da APREV Advocacia Previdenciária. Usa /icon-192.png como fonte -
// mesmo arquivo do ícone do PWA, redimensionado via width/height conforme o
// lugar onde aparece (menu lateral, telas de login, etc).
export default function Logo({ size = 32, className = '' }) {
  return (
    <img
      src="/icon-192.png"
      alt="APREV Advocacia Previdenciária"
      width={size}
      height={size}
      className={`rounded-lg shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
