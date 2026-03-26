import { z } from 'zod';
import { getYarnColorsByBrand } from '@/lib/yarn';

const querySchema = z.object({
  brandId: z.string().min(1),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  const parsed = querySchema.safeParse({
    brandId: url.searchParams.get('brandId'),
  });

  if (!parsed.success) {
    return Response.json({ error: 'brandId is required.' }, { status: 400 });
  }

  const colors = getYarnColorsByBrand(parsed.data.brandId).map((color) => ({
    id: color.id,
    name: color.name,
    hex: color.hex,
  }));

  return Response.json({ colors }, { status: 200 });
}
