// A small hand-kept sitemap.
const pages = ['/', '/changelog', '/support', '/privacy', '/terms', '/refunds'];

export function GET({ site }: { site: URL }) {
    const urls = pages.map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`).join('\n');
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
        headers: { 'Content-Type': 'application/xml' },
    });
}
