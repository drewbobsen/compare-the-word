import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const API_URL = process.env.INTERNAL_API_URL || "http://api:8080";

    const res  = await fetch(`${API_URL}/api/books`, { cache: 'force-cache'});
    const books = await res.json();

    const routes: MetadataRoute.Sitemap = [
        {
            url: 'https://comparetheword.app',
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 1,
        }
    ];

    books.forEach((book: {book: string})=> {
        routes.push({
            url: `https://comparetheword.app/?book=${book.book}&amp;chapter=1&amp;t1=kjv&amp;t2=web`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        });
    });

    return routes;
}