import QRCode from 'qrcode';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalized = code.toUpperCase();
  const url = new URL(request.url);
  const target =
    url.searchParams.get('url') ?? `${url.origin}/room/${normalized}`;
  const svg = await QRCode.toString(target, { type: 'svg', margin: 1, width: 512 });
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
