interface Props {
  code: string;
  joinUrl: string;
}

export function QrPoster({ code, joinUrl }: Props) {
  const qrSrc = `/api/qr/${code}?url=${encodeURIComponent(joinUrl)}`;
  return (
    <div className="flex flex-col items-center gap-3 bg-white rounded-2xl p-6 shadow-xl">
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamiczny SVG route, next/image nie obsługuje bez loaderConfig */}
      <img src={qrSrc} alt={`QR do pokoju ${code}`} className="w-64 h-64" />
<p className="font-mono text-2xl font-bold tracking-widest text-neutral-900">{code}</p>
    </div>
  );
}
